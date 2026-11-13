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
from .config import settings
from .models import StoreDocument, now, Category, Customer, Order, OrderEvent, Payment, Product, Variant
from .schemas import CartItem, OrderInput


def digest(value) -> str:
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(',', ':'), default=str).encode()).hexdigest()


def money(value) -> str:
    return str(Decimal(value).quantize(Decimal('0.01')))


def product_view(product: Product):
    return {'id': product.id, 'name': product.name, 'category_id': product.category_id,
            'category': product.category.name, 'description': product.description, 'image': product.image,
            'active': product.active, 'sale_enabled': product.sale_enabled and
            (not product.metadata_json.get('payment_test') or settings().test_checkout_enabled), 'currency': 'INR',
            'version': product.version, 'metadata': product.metadata_json,
            'variants': [{'id': v.id, 'label': v.label, 'price': money(v.price), 'stock': v.stock,
                          'enabled': v.enabled} for v in product.variants]}


def order_view(order: Order):
    date = order.created_at.replace(tzinfo=timezone.utc).isoformat()
    next_statuses = sorted(TRANSITIONS.get(order.status, set()))
    if order.kind=='gateway_check':next_statuses=[]
    if order.payment == 'RAZORPAY':
        next_statuses = [s for s in next_statuses if s != 'Cancelled'] if order.payment_record and order.payment_record.status == 'paid' else []
    return {'id': order.id, 'dateISO': date, 'date': date, **order.shipping,
            'phone': order.phone.removeprefix('+91'), 'items': order.items,
            'subtotal': money(order.subtotal), 'delivery': money(order.delivery),
            'deliveryBreakdown': order.delivery_breakdown, 'total': money(order.total),
            'currency': 'INR', 'payment': order.payment, 'status': order.status,
            'kind': order.kind,
            'payment_status': order.payment_record.status if order.payment_record else 'due_on_delivery',
            'payment_mode': order.payment_record.mode if order.payment_record else None,
            'allowed_next_statuses': next_statuses, 'updatedAtISO': order.updated_at.replace(tzinfo=timezone.utc).isoformat()}


def calculate(db: Session, items: list[CartItem], lock=False, pin='', payment='RAZORPAY'):
    # Lock products and variants in a consistent order to avoid overselling.
    ids = sorted({item.variant_id for item in items})
    initial = db.scalars(select(Variant).where(Variant.id.in_(ids))).all()
    product_ids = sorted({variant.product_id for variant in initial})
    statement = select(Product).where(Product.id.in_(product_ids)).order_by(Product.id)
    if lock:
        statement = statement.with_for_update()
    products = {product.id: product for product in db.scalars(statement).unique().all()}
    test_products = [p for p in products.values() if p.metadata_json.get('payment_test')]
    if test_products:
        if not settings().test_checkout_enabled:
            raise HTTPException(409, 'Payment testing is currently unavailable.')
        if len(test_products) != len(products):
            raise HTTPException(409, 'Use the payment-test product in a separate bag from regular products.')
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
    from .shipping import delivery_quote
    delivery, breakdown, pending = delivery_quote(db, products, quantities, variants, pin, payment)
    if subtotal + delivery > Decimal('9999999.00'):
        raise HTTPException(422, 'This order exceeds the online order limit. Contact the store.')
    quote = {'items': lines, 'subtotal': money(subtotal), 'delivery': money(delivery),
             'deliveryBreakdown': breakdown, 'total': money(subtotal + delivery), 'currency': 'INR',
             'delivery_pending': pending, 'destination_pin': pin}
    quote['payment_mode']=settings().razorpay_mode
    if test_products:
        quote['payment_test'] = True
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
        if data.payment=='RAZORPAY':
            from .payments import new_payments_enabled
            if not new_payments_enabled():raise HTTPException(503,'Online payments are being configured. Your bag is kept; please try again shortly.')
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
        if not user.phone or len(user.phone)!=13:
            raise HTTPException(422,'Enter your delivery contact mobile number before placing the order.')
        quote, quantities, variants, products = calculate(db, data.items, lock=True, pin=data.shipping.pin, payment=data.payment)
        if quote['delivery_pending']:
            raise HTTPException(409, 'Review your delivery quote before placing the order.')
        if quote.get('payment_test') and data.payment != 'RAZORPAY':
            raise HTTPException(422, 'The payment-test product requires Razorpay Test Mode.')
        if quote['quote_hash'] != data.quote_hash:
            raise HTTPException(409, 'Prices or delivery charges changed. Reopen checkout to review the new total.')
        customer = db.get(Customer, user.uid)
        if not customer:
            from .models import now
            customer = Customer(uid=user.uid, phone=user.phone, details=data.shipping.model_dump(), first_verified_at=now())
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
                      total=Decimal(quote['total']), payment=data.payment, status='Awaiting Payment' if data.payment=='RAZORPAY' else 'Order Confirmed')
        db.add(order)
        db.flush()
        if data.payment=='RAZORPAY':
            db.add(Payment(order_id=order.id,amount_paise=int(order.total*100),currency='INR',mode=settings().razorpay_mode,key_id=settings().payment_keys()[0] or None))
        db.add(OrderEvent(order_id=order.id, actor_uid=user.uid, status=order.status))
        from .reporting import enqueue_order
        enqueue_order(db, order, 'order_created')
        from .carts import mark_ordered
        from .messaging import enqueue_order as enqueue_whatsapp
        mark_ordered(db,user.uid)
        enqueue_whatsapp(db,order)
        touch_catalog(db)
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
    if order.kind=='gateway_check':raise HTTPException(409,'A payment connection check has no product or delivery to fulfil.')
    if order.payment=='RAZORPAY':
        payment=db.scalar(select(Payment).where(Payment.order_id==order.id))
        if not payment or payment.status!='paid':
            raise HTTPException(409, 'Payment must be captured before fulfilment.')
        if status=='Cancelled':
            raise HTTPException(409, 'Online payments require a reviewed refund before cancellation. Contact the store.')
    if status == order.status:
        return order
    if status not in TRANSITIONS.get(order.status, set()):
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
    if status == 'Cancelled':
        touch_catalog(db)
    order.status = status
    db.add(OrderEvent(order_id=order.id, actor_uid=user.uid, status=status))
    from .reporting import enqueue_order
    enqueue_order(db, order, 'order_status')
    from .messaging import enqueue_order as enqueue_whatsapp
    enqueue_whatsapp(db,order)
    db.commit()
    return order


def touch_catalog(db):
    from sqlalchemy.dialects.mysql import insert
    statement=insert(StoreDocument).values(key='catalog_revision',value={},version=1,updated_at=now())
    db.execute(statement.on_duplicate_key_update(version=StoreDocument.version+1,updated_at=now()))
