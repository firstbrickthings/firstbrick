"""Explicit owner-initiated ₹10 live check; no products, delivery, stock or marketing."""
from decimal import Decimal
from uuid import uuid4
from fastapi import APIRouter,Depends,HTTPException
from pydantic import Field
from sqlalchemy import select
from sqlalchemy.orm import Session
from .auth import Identity,admin
from .config import settings
from .db import database
from .models import Order,OrderEvent,Payment
from .schemas import Input
from .services import order_view,digest
from .carts import lock_customer
from .payments import new_payments_enabled

router=APIRouter(prefix='/api/admin/payments/check')
class CheckInput(Input):
    request_id:str=Field(pattern=r'^[a-f0-9-]{36}$')

@router.get('/latest')
def latest(user:Identity=Depends(admin),db:Session=Depends(database)):
    row=db.scalar(select(Order).where(Order.customer_uid==user.uid,Order.kind=='gateway_check',Order.request_hash==digest({'kind':'gateway_check','amount':'10.00','uid':user.uid})).order_by(Order.created_at.desc(),Order.id.desc()).limit(1))
    return {'order':order_view(row) if row else None,'request_id':row.idempotency_key if row else None}

@router.post('')
def create(data:CheckInput,user:Identity=Depends(admin),db:Session=Depends(database)):
    if settings().razorpay_mode!='live' or not new_payments_enabled():raise HTTPException(409,'This owner check requires the configured live payment connection.')
    customer=lock_customer(db,user)
    old=db.scalar(select(Order).where(Order.customer_uid==user.uid,Order.idempotency_key==data.request_id).with_for_update())
    if old:
        if old.kind!='gateway_check':raise HTTPException(409,'This request ID belongs to another order.')
        return order_view(old)
    pending=db.scalar(select(Order).where(Order.customer_uid==user.uid,Order.kind=='gateway_check',Order.request_hash==digest({'kind':'gateway_check','amount':'10.00','uid':user.uid}),Order.status=='Awaiting Payment').order_by(Order.created_at.desc()).with_for_update().limit(1))
    if pending:return order_view(pending)
    row=Order(id='BO-'+uuid4().hex.upper(),customer_uid=user.uid,idempotency_key=data.request_id,request_hash=digest({'kind':'gateway_check','amount':'10.00','uid':user.uid}),phone=user.phone,
              shipping={'name':customer.details.get('name') or 'BabyOne owner','email':customer.details.get('email') or ''},
              items=[{'id':'owner-gateway-check','name':'One-time live payment connection check','qty':1,'price':'10.00','image':'assets/favicon.svg'}],subtotal=Decimal('10.00'),delivery=Decimal('0'),delivery_breakdown=[],total=Decimal('10.00'),payment='RAZORPAY',kind='gateway_check',status='Awaiting Payment')
    db.add(row);db.flush();db.add(Payment(order_id=row.id,amount_paise=1000,currency='INR',mode='live',key_id=settings().payment_keys('live')[0]));db.add(OrderEvent(order_id=row.id,actor_uid=user.uid,status='Awaiting Payment'));db.commit()
    return order_view(row)
