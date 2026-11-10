import hashlib
import json
from datetime import timezone
from decimal import Decimal
from uuid import uuid4
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from .auth import Identity
from .models import Category, Customer, Order, OrderEvent, Product, Variant
from .schemas import CartItem, OrderInput


def digest(value) -> str:
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(',', ':'), default=str).encode()).hexdigest()


def money(value) -> str:
    return str(Decimal(value).quantize(Decimal('0.01')))


def product_view(product: Product):
    return {'id': product.id, 'name': product.name, 'category_id': product.category_id,
            'category': product.category.name, 'description': product.description, 'image': product.image,
            'active': product.active, 'sale_enabled': product.sale_enabled, 'currency': 'INR',
            'version': product.version, 'metadata': product.metadata_json,
            'variants': [{'id': v.id, 'label': v.label, 'price': money(v.price), 'stock': v.stock,
                          'enabled': v.enabled} for v in product.variants]}


def order_view(order: Order):
    date = order.created_at.replace(tzinfo=timezone.utc).isoformat()
    return {'id': order.id, 'dateISO': date, 'date': date, **order.shipping,
            'phone': order.phone.removeprefix('+91'), 'items': order.items,
            'subtotal': money(order.subtotal), 'delivery': money(order.delivery),
            'deliveryBreakdown': order.delivery_breakdown, 'total': money(order.total),
            'currency': 'INR', 'payment': order.payment, 'status': order.status}


def calculate(db: Session, items: list[CartItem], lock=False):
    # Lock products and variants in a consistent order to avoid overselling.
    ids = sorted({item.variant_id for item in items})
    initial = db.scalars(select(Variant).where(Variant.id.in_(ids))).all()
    product_ids = sorted({variant.product_id for variant in initial})
    statement = select(Product).where(Product.id.in_(product_ids)).order_by(Product.id)
    if lock:
        statement = statement.with_for_update()
    products = {product.id: product for product in db.scalars(statement).unique().all()}
    statement = select(Variant).where(Variant.id.in_(ids)).order_by(Variant.id).execution_options(populate_existing=True)
    if lock:
        statement = statement.with_for_update()
    variants = {variant.id: variant for variant in db.scalars(statement).all()}
    quantities: dict[str, int] = {}
    for item in items:
        quantities[item.variant_id] = quantities.get(item.variant_id, 0) + item.quantity
    for variant_id, quantity in quantities.items():
        variant = variants.get(variant_id)
        product = products.get(variant.product_id) if variant else None
        if not variant or not product or not product.active or not product.sale_enabled or not variant.enabled or variant.price <= 0:
            raise HTTPException(409, 'An item has not been approved for sale or is unavailable. Please update your bag.')
        if quantity > 100 or quantity > variant.stock:
            raise HTTPException(409, f'Not enough stock for {product.name}. Please reduce the quantity.')
    lines, categories = [], {}
    # Aggregate duplicate lines so requests cannot bypass stock limits.
    grouped: dict[tuple[str, str | None], int] = {}
    for item in items:
        key = (item.variant_id, item.pattern_id)
        grouped[key] = grouped.get(key, 0) + item.quantity
    for (variant_id, pattern_id), quantity in sorted(grouped.items(), key=lambda row: str(row[0])):
        variant = variants[variant_id]
        product = products[variant.product_id]
        pattern_name = None
        if pattern_id:
            pattern = next((p for p in product.metadata_json.get('patterns', []) if p.get('id') == pattern_id), None)
            if not pattern or pattern.get('available') is False:
                raise HTTPException(409, 'That pattern is not available. Select an available product option.')
            pattern_name = pattern.get('name', pattern_id)
        category = product.category
        categories[category.id] = {'category': category.name, 'rate': money(category.delivery_fee)}
        label = product.name + (f' — {variant.label}' if variant.label else '') + (f' — {pattern_name}' if pattern_name else '')
        lines.append({'id': product.id, 'variant_id': variant.id, 'size': variant.label,
                      'patternId': pattern_id, 'patternName': pattern_name,
                      'name': label, 'image': product.image, 'price': money(variant.price), 'qty': quantity,
                      'category': category.name, 'line_total': money(variant.price * quantity)})
    subtotal = sum((Decimal(line['line_total']) for line in lines), Decimal('0'))
    breakdown = [categories[key] for key in sorted(categories)]
    delivery = sum((Decimal(row['rate']) for row in breakdown), Decimal('0'))
    if subtotal + delivery > Decimal('9999999.00'):
        raise HTTPException(422, 'This order exceeds the online order limit. Contact the store.')
    quote = {'items': lines, 'subtotal': money(subtotal), 'delivery': money(delivery),
             'deliveryBreakdown': breakdown, 'total': money(subtotal + delivery), 'currency': 'INR'}
    quote['quote_hash'] = digest(quote)
    return quote, quantities, variants, products


def place_order(db: Session, user: Identity, data: OrderInput):
    request_hash = digest(data.model_dump(exclude={'quote_hash'}))
    existing_statement = select(Order).where(Order.customer_uid == user.uid, Order.idempotency_key == data.idempotency_key)

    def same(existing):
        if existing.request_hash != request_hash:
            raise HTTPException(409, 'This request ID was already used for a different order. Refresh checkout.')
        return existing

    try:
        # READ COMMITTED avoids gap-locking a missing request key. The unique key handles races.
        existing = db.scalar(existing_statement.with_for_update())
        if existing:
            db.rollback()
            return same(existing)
        # A concurrent retry may have missed the first lookup before the other
        # transaction committed. Recheck after its product locks are released,
        # before stock validation (the original order may have consumed all stock).
        variant_ids=sorted({item.variant_id for item in data.items})
        product_ids=select(Variant.product_id).where(Variant.id.in_(variant_ids))
        db.scalars(select(Product).where(Product.id.in_(product_ids)).order_by(Product.id).with_for_update()).unique().all()
        existing=db.scalar(existing_statement)
        if existing:
            db.rollback()
            return same(existing)
        quote, quantities, variants, products = calculate(db, data.items, lock=True)
        if quote['quote_hash'] != data.quote_hash:
            raise HTTPException(409, 'Prices or delivery charges changed. Reopen checkout to review the new total.')
        customer = db.get(Customer, user.uid)
        if not customer:
            customer = Customer(uid=user.uid, phone=user.phone, details=data.shipping.model_dump())
            db.add(customer)
            db.flush()
        else:
            customer.phone, customer.details = user.phone, data.shipping.model_dump()
        for variant_id, quantity in quantities.items():
            variants[variant_id].stock -= quantity
        for product in products.values():
            product.version += 1
        order = Order(id='BO-' + uuid4().hex.upper(), customer_uid=user.uid,
                      idempotency_key=data.idempotency_key, request_hash=request_hash, phone=user.phone,
                      shipping=data.shipping.model_dump(), items=quote['items'], subtotal=Decimal(quote['subtotal']),
                      delivery=Decimal(quote['delivery']), delivery_breakdown=quote['deliveryBreakdown'],
                      total=Decimal(quote['total']), payment='COD', status='Order Confirmed')
        db.add(order)
        db.flush()
        db.add(OrderEvent(order_id=order.id, actor_uid=user.uid, status=order.status))
        db.commit()
        return order
    except IntegrityError:
        db.rollback()
        existing = db.scalar(existing_statement)
        if existing:
            return same(existing)
        raise HTTPException(409, 'The store data changed during checkout. Please retry.') from None
    except Exception:
        db.rollback()
        raise


TRANSITIONS = {'Order Confirmed': {'Packed', 'Cancelled'}, 'Packed': {'Shipped', 'Cancelled'},
               'Shipped': {'Out for Delivery'}, 'Out for Delivery': {'Delivered'}, 'Delivered': set(), 'Cancelled': set()}


def change_status(db: Session, order_id: str, status: str, user: Identity):
    order = db.scalar(select(Order).where(Order.id == order_id).with_for_update())
    if not order:
        raise HTTPException(404, 'Order not found.')
    if status == order.status:
        return order
    if status not in TRANSITIONS[order.status]:
        raise HTTPException(409, 'This status transition is not allowed.')
    if status == 'Cancelled':
        ids = sorted({line['variant_id'] for line in order.items})
        product_ids = sorted({line['id'] for line in order.items})
        products = db.scalars(select(Product).where(Product.id.in_(product_ids)).order_by(Product.id).with_for_update()).unique().all()
        variants = {v.id: v for v in db.scalars(select(Variant).where(Variant.id.in_(ids)).order_by(Variant.id).with_for_update()).all()}
        for line in order.items:
            variants[line['variant_id']].stock += line['qty']
        for product in products:
            product.version += 1
    order.status = status
    db.add(OrderEvent(order_id=order.id, actor_uid=user.uid, status=status))
    db.commit()
    return order
