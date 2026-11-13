"""Verified-account saved carts. Cart prices are always read from the live catalogue."""
from collections import defaultdict
from datetime import timedelta, timezone
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import Field
from sqlalchemy import select
from sqlalchemy.orm import Session
from .auth import Identity, admin, identity
from .db import database
from .models import Customer, CustomerCart, Order, Product, Variant, WhatsAppMessage, WhatsAppPreference, now
from .schemas import CartItem, Input

router=APIRouter(prefix='/api')


class CartInput(Input):
    items: list[CartItem] = Field(default_factory=list,max_length=50)
    expected_version: int = Field(ge=0)


class PreferenceInput(Input):
    order_updates: bool
    cart_reminders: bool


def lock_customer(db,user):
    customer=db.scalar(select(Customer).where(Customer.uid==user.uid).with_for_update())
    if not customer:
        customer=Customer(uid=user.uid,phone=user.phone,first_verified_at=now(),details={})
        db.add(customer);db.flush()
    return customer


def normalize_items(db,items):
    groups=defaultdict(int);quantities=defaultdict(int)
    variants={v.id:v for v in db.scalars(select(Variant).where(Variant.id.in_([i.variant_id for i in items])))}
    products={p.id:p for p in db.scalars(select(Product).where(Product.id.in_([v.product_id for v in variants.values()]))).unique()}
    for item in items:
        variant=variants.get(item.variant_id)
        if not variant or not variant.enabled or not products[variant.product_id].active:
            raise HTTPException(409,'An item is no longer available. Refresh your bag before saving.')
        if item.pattern_id and not any(p.get('id')==item.pattern_id for p in products[variant.product_id].metadata_json.get('patterns',[])):
            raise HTTPException(409,'A product pattern changed. Select it again.')
        groups[(item.variant_id,item.pattern_id)]+=item.quantity;quantities[item.variant_id]+=item.quantity
    if any(q>100 for q in quantities.values()):raise HTTPException(422,'Use up to 100 units per product option.')
    return [{'variant_id':v,'pattern_id':p,'quantity':q} for (v,p),q in sorted(groups.items(),key=lambda x:str(x[0]))]


def cart_view(db,cart):
    if not cart:return {'items':[],'version':0,'subtotal':'0.00','updated_at':None,'ordered':False}
    variants={v.id:v for v in db.scalars(select(Variant).where(Variant.id.in_([i['variant_id'] for i in cart.items])))}
    products={p.id:p for p in db.scalars(select(Product).where(Product.id.in_([v.product_id for v in variants.values()]))).unique()}
    lines=[];subtotal=Decimal('0')
    for item in cart.items:
        variant=variants.get(item['variant_id']);product=products.get(variant.product_id) if variant else None
        if not product:
            lines.append({**item,'name':'Unavailable product','available':False,'image':'','price':'0.00'});continue
        pattern=next((p for p in product.metadata_json.get('patterns',[]) if p.get('id')==item.get('pattern_id')),None)
        available=product.active and product.sale_enabled and variant.enabled and variant.stock>=item['quantity'] and (not item.get('pattern_id') or bool(pattern and pattern.get('available',True)))
        total=variant.price*item['quantity'];subtotal+=total
        lines.append({**item,'id':product.id,'name':product.name,'size':variant.label,'image':product.image,
                      'price':str(variant.price),'line_total':str(total),'available':bool(available),
                      'pattern_name':pattern.get('name','') if pattern else ''})
    return {'items':lines,'version':cart.version,'subtotal':str(subtotal.quantize(Decimal('0.01'))),
            'updated_at':cart.updated_at.replace(tzinfo=timezone.utc).isoformat(),'ordered':cart.ordered_at is not None}


def cancel_reminders(db,uid):
    for message in db.scalars(select(WhatsAppMessage).where(WhatsAppMessage.customer_uid==uid,WhatsAppMessage.kind=='cart_reminder',WhatsAppMessage.status.in_(['pending','processing'])).with_for_update()):
        message.status='cancelled'


def schedule_reminder(db,cart):
    preference=db.get(WhatsAppPreference,cart.customer_uid)
    if not cart.items or cart.ordered_at or not preference or not preference.cart_reminders:return
    from .messaging import event_key
    key=event_key('cart',cart.customer_uid,str(cart.version))
    if not db.scalar(select(WhatsAppMessage.id).where(WhatsAppMessage.event_key==key)):
        from uuid import uuid4
        db.add(WhatsAppMessage(id=str(uuid4()),customer_uid=cart.customer_uid,event_key=key,kind='cart_reminder',cart_version=cart.version,payload={},due_at=cart.updated_at+timedelta(minutes=20)))


@router.get('/me/cart')
def my_cart(user:Identity=Depends(identity),db:Session=Depends(database)):
    return cart_view(db,db.get(CustomerCart,user.uid))


@router.put('/me/cart')
def save_cart(data:CartInput,user:Identity=Depends(identity),db:Session=Depends(database)):
    lock_customer(db,user)
    row=db.get(CustomerCart,user.uid)
    if data.expected_version!=(row.version if row else 0):raise HTTPException(409,'Your saved bag changed on another device. Load it before saving again.')
    items=normalize_items(db,data.items)
    if row and row.items==items and not row.ordered_at:
        return cart_view(db,row)
    cancel_reminders(db,user.uid)
    if not row:
        row=CustomerCart(customer_uid=user.uid,items=items,version=1,updated_at=now());db.add(row)
    else:row.items, row.version, row.updated_at, row.ordered_at=items,row.version+1,now(),None
    db.flush();schedule_reminder(db,row);db.commit()
    return cart_view(db,row)


def preference_view(row,user):
    return {'phone':user.phone,'order_updates':bool(row and row.order_updates),'cart_reminders':bool(row and row.cart_reminders),'consent_at':row.consent_at.replace(tzinfo=timezone.utc).isoformat() if row and row.consent_at else None}


@router.get('/me/whatsapp')
def get_preferences(user:Identity=Depends(identity),db:Session=Depends(database)):
    return preference_view(db.get(WhatsAppPreference,user.uid),user)


@router.put('/me/whatsapp')
def set_preferences(data:PreferenceInput,user:Identity=Depends(identity),db:Session=Depends(database)):
    lock_customer(db,user)
    row=db.get(WhatsAppPreference,user.uid)
    if not row:row=WhatsAppPreference(customer_uid=user.uid,phone=user.phone);db.add(row)
    row.phone=user.phone;row.order_updates=data.order_updates;row.cart_reminders=data.cart_reminders;row.consent_at=now()
    if not data.cart_reminders:cancel_reminders(db,user.uid)
    if not data.order_updates:
        for message in db.scalars(select(WhatsAppMessage).where(WhatsAppMessage.customer_uid==user.uid,WhatsAppMessage.kind=='order_update',WhatsAppMessage.status.in_(['pending','processing'])).with_for_update()):message.status='cancelled'
    db.flush()
    cart=db.get(CustomerCart,user.uid)
    if data.cart_reminders and cart:schedule_reminder(db,cart)
    db.commit();return preference_view(row,user)


def mark_ordered(db,uid):
    # Serialize cart writes and reminder sends with the verified customer record.
    db.scalar(select(Customer).where(Customer.uid==uid).with_for_update())
    cart=db.get(CustomerCart,uid)
    if cart:cart.ordered_at=now()
    cancel_reminders(db,uid)


@router.get('/admin/customer')
def customer_details(uid:str=Query(...,min_length=1,max_length=128),user:Identity=Depends(admin),db:Session=Depends(database)):
    row=db.get(Customer,uid)
    if not row:raise HTTPException(404,'Customer not found.')
    from .services import order_view
    from .legacy import list_orders
    orders=[order_view(o) for o in db.scalars(select(Order).where(Order.customer_uid==uid).order_by(Order.created_at.desc()).limit(100))]
    orders.extend(list_orders(db,row.phone))
    return {'uid':row.uid,'phone':row.phone,'details':row.details,'cart':cart_view(db,db.get(CustomerCart,uid)),
            'orders':sorted(orders,key=lambda o:o['dateISO'],reverse=True)[:100],
            'whatsapp':preference_view(db.get(WhatsAppPreference,uid),Identity(uid,row.phone))}


class DeliveryPreview(Input):
    pin: str = Field(pattern=r'^[1-9][0-9]{5}$')
    parcel: dict | None = None
    parcels: int = Field(default=1,ge=1,le=100,strict=True)
    payment: str = Field(default='RAZORPAY',pattern=r'^(COD|RAZORPAY)$')


@router.post('/admin/delivery/preview')
def preview_delivery(data:DeliveryPreview,user:Identity=Depends(admin),db:Session=Depends(database)):
    from types import SimpleNamespace
    from .shipping import Parcel,configuration,delivery_quote
    metadata={}
    if configuration(db).pricing_mode == 'weight':
        try:parcel=Parcel.model_validate(data.parcel)
        except ValueError:raise HTTPException(422,'Check all four packed parcel measurements.') from None
        metadata={'shipping':parcel.model_dump(mode='json')}
    product=SimpleNamespace(id='preview-parcel',name='Packed parcel',metadata_json=metadata)
    total,breakdown,_=delivery_quote(db,{'preview-parcel':product},{'preview-variant':data.parcels},{'preview-variant':SimpleNamespace(product_id='preview-parcel')},data.pin,data.payment,allow_draft=True)
    return {'delivery':str(total),'breakdown':breakdown,'rates_confirmed':configuration(db).confirmed}
