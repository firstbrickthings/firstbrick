"""Razorpay TEST-mode adapter. Secrets and card details never reach store responses/logs."""
import base64
import hashlib
import hmac
import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from decimal import Decimal
from functools import lru_cache
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from .config import settings
from .models import Order, OrderEvent, Payment, PaymentEvent
from .services import order_view


class GatewayError(Exception):
    def __init__(self, uncertain=True):
        self.uncertain=uncertain


class Gateway:
    def __init__(self):
        config=settings()
        if not config.razorpay_key_id.startswith('rzp_test_') or not config.razorpay_key_secret:
            raise HTTPException(503, 'Razorpay Test Mode is not configured. Live payments are disabled.')
        self.key_id=config.razorpay_key_id
        self.secret=config.razorpay_key_secret

    def call(self, method, path, data=None):
        auth=base64.b64encode((self.key_id+':'+self.secret).encode()).decode()
        req=urllib.request.Request('https://api.razorpay.com/v1'+path,
            data=json.dumps(data).encode() if data is not None else None,method=method,
            headers={'Authorization':'Basic '+auth,'Content-Type':'application/json','User-Agent':'BabyOne-Test/1.0'})
        try:
            with urllib.request.urlopen(req,timeout=12) as response:
                return json.load(response)
        except urllib.error.HTTPError as error:
            # Do not expose provider payloads, headers or credentials to logs/clients.
            raise GatewayError(uncertain=error.code>=500) from None
        except (OSError,ValueError):
            raise GatewayError() from None


@lru_cache(maxsize=4)
def upi_availability(public_key, minute):
    # Cache provider capabilities for at most one minute, including failed probes.
    try:
        methods = Gateway().call('GET', '/methods?' + urllib.parse.urlencode({'key_id': public_key}))
        return methods.get('upi') if isinstance(methods, dict) and isinstance(methods.get('upi'), bool) else None
    except (GatewayError, HTTPException):
        return None


def checkout_config():
    config = settings()
    enabled = config.razorpay_key_id.startswith('rzp_test_') and bool(config.razorpay_key_secret)
    upi = upi_availability(config.razorpay_key_id, int(time.monotonic() // 60)) if enabled else False
    return {'razorpay_test_enabled': enabled, 'test_mode': True, 'upi_enabled': upi is True,
            'upi_availability': 'unknown' if upi is None else ('available' if upi else 'unavailable')}


def owned_order(db, order_id, user):
    order=db.scalar(select(Order).where(Order.id==order_id,Order.customer_uid==user.uid).with_for_update())
    if not order:
        raise HTTPException(404,'Order not found.')
    if order.payment!='RAZORPAY':
        raise HTTPException(409,'This order uses cash on delivery.')
    return order


def payment_for(db, order):
    payment=db.scalar(select(Payment).where(Payment.order_id==order.id).with_for_update().execution_options(populate_existing=True))
    if not payment:
        raise HTTPException(409,'The payment record is unavailable. Contact the store.')
    return payment


def payment_view(order,payment):
    return {'order':order_view(order),'payment_status':payment.status,'razorpay_order_id':payment.provider_order_id,
            'razorpay_payment_id':payment.provider_payment_id,'test_mode':True}


def validate_provider_order(remote,order,payment):
    if (not re.fullmatch(r'order_[A-Za-z0-9]+',str(remote.get('id',''))) or
        remote.get('receipt')!=order.id or remote.get('amount')!=payment.amount_paise or
        remote.get('currency')!='INR' or remote.get('partial_payment') is True):
        raise HTTPException(502,'The payment order does not match your shop order.')


def begin(db,order_id,user):
    gateway=Gateway()
    order=owned_order(db,order_id,user);payment=payment_for(db,order)
    if payment.status=='paid':
        return payment_view(order,payment)
    if not payment.provider_order_id:
        if payment.create_attempted:
            try:
                rows=gateway.call('GET','/orders?'+urllib.parse.urlencode({'receipt':order.id,'count':100}))['items']
            except GatewayError:
                raise HTTPException(503,'Waiting for Razorpay. Retry this same order shortly.') from None
            matching=[row for row in rows if row.get('receipt')==order.id]
            if len(matching)!=1:
                raise HTTPException(503,'The gateway order is awaiting reconciliation. Retry later or contact the store; do not create another order.')
            remote=matching[0]
        else:
            payment.create_attempted=True
            db.commit()  # Persist intent before contacting an external system.
            try:
                remote=gateway.call('POST','/orders',{'amount':payment.amount_paise,'currency':'INR',
                    'receipt':order.id,'partial_payment':False,'notes':{'store_order_id':order.id,'mode':'test'}})
            except GatewayError as error:
                order=owned_order(db,order_id,user);payment=payment_for(db,order)
                if not error.uncertain:payment.create_attempted=False
                db.commit()
                raise HTTPException(503,'Razorpay could not open checkout. Retry this same order; your bag is kept.') from None
            order=owned_order(db,order_id,user);payment=payment_for(db,order)
        validate_provider_order(remote,order,payment)
        payment.provider_order_id=remote['id'];db.commit()
    return {**payment_view(order,payment),'checkout':{'key':gateway.key_id,'order_id':payment.provider_order_id,
        'amount':payment.amount_paise,'currency':'INR','name':'BabyOne','description':'BabyOne TEST payment',
        'prefill':{'name':order.shipping['name'],'contact':order.phone,'email':order.shipping.get('email','')}}}


def apply_payment(db,order,payment,remote,gateway,capture=True):
    if (remote.get('order_id')!=payment.provider_order_id or remote.get('amount')!=payment.amount_paise
        or remote.get('currency')!='INR' or not re.fullmatch(r'pay_[A-Za-z0-9]+',str(remote.get('id','')))):
        raise HTTPException(409,'Payment amount, currency or order does not match.')
    if payment.status=='paid':return
    if remote.get('status')=='authorized' and capture:
        try:
            remote=gateway.call('POST','/payments/'+remote['id']+'/capture',{'amount':payment.amount_paise,'currency':'INR'})
        except GatewayError:
            # Capture could have succeeded before a lost response; fetch the authoritative state.
            remote=gateway.call('GET','/payments/'+remote['id'])
        return apply_payment(db,order,payment,remote,gateway,capture=False)
    if remote.get('status')=='captured' and remote.get('captured') is True:
        payment.status='paid';payment.provider_payment_id=remote['id']
        if order.status=='Awaiting Payment':
            order.status='Order Confirmed'
            db.add(OrderEvent(order_id=order.id,actor_uid='razorpay',status='Order Confirmed'))
            from .reporting import enqueue_order
            enqueue_order(db,order,'payment_confirmed')
    elif remote.get('status')=='failed':payment.status='failed'
    elif remote.get('status')=='authorized':payment.status='authorized'


def verify(db,order_id,user,data):
    gateway=Gateway();order=owned_order(db,order_id,user);payment=payment_for(db,order)
    if not payment.provider_order_id or data.razorpay_order_id!=payment.provider_order_id:
        raise HTTPException(400,'The payment order does not match.')
    signature=hmac.new(gateway.secret.encode(),(payment.provider_order_id+'|'+data.razorpay_payment_id).encode(),hashlib.sha256).hexdigest()
    if not hmac.compare_digest(signature,data.razorpay_signature):
        raise HTTPException(400,'Payment signature verification failed.')
    try:
        remote=gateway.call('GET','/payments/'+data.razorpay_payment_id)
        apply_payment(db,order,payment,remote,gateway)
        db.commit()
    except GatewayError:
        db.rollback();raise HTTPException(503,'Payment verification is pending. Check payment status; do not pay again.') from None
    return payment_view(order,payment)


def refresh(db,order_id,user):
    gateway=Gateway();order=owned_order(db,order_id,user);payment=payment_for(db,order)
    if payment.status!='paid' and payment.provider_order_id:
        try:
            rows=gateway.call('GET','/orders/'+payment.provider_order_id+'/payments')['items']
            # A delayed failure can never downgrade an already captured payment.
            rows.sort(key=lambda row: {'failed':0,'authorized':1,'captured':2}.get(row.get('status'),0))
            for remote in rows:apply_payment(db,order,payment,remote,gateway)
            db.commit()
        except GatewayError:
            db.rollback();raise HTTPException(503,'Payment status is temporarily unavailable. Please check again.') from None
    return payment_view(order,payment)


def webhook(db,body,signature,event_id):
    secret=settings().razorpay_webhook_secret
    if not secret:raise HTTPException(503,'Payment notifications are not configured.')
    expected=hmac.new(secret.encode(),body,hashlib.sha256).hexdigest()
    if not signature or not hmac.compare_digest(expected,signature):raise HTTPException(400,'Invalid webhook signature.')
    try:data=json.loads(body)
    except ValueError:raise HTTPException(400,'Invalid notification.') from None
    event_type=data.get('event','')
    if event_type not in {'payment.captured','payment.authorized','payment.failed','order.paid'}:return {'received':True}
    remote=data.get('payload',{}).get('payment',{}).get('entity',{})
    provider_id=remote.get('order_id')
    # Find the parent before taking locks; all writers lock order then payment.
    payment=db.scalar(select(Payment).where(Payment.provider_order_id==provider_id)) if provider_id else None
    if not payment:return {'received':True,'matched':False}
    order=db.scalar(select(Order).where(Order.id==payment.order_id).with_for_update())
    payment=payment_for(db,order)
    event_hash=hashlib.sha256((event_id or hashlib.sha256(body).hexdigest()).encode()).hexdigest()
    if db.get(PaymentEvent,event_hash):return {'received':True,'duplicate':True}
    try:
        # Fetch provider state too; a signed notification alone cannot change the expected amount/order.
        gateway=Gateway()
        entity=gateway.call('GET','/payments/'+remote.get('id',''))
        apply_payment(db,order,payment,entity,gateway)
        db.add(PaymentEvent(event_id=event_hash,event_type=event_type,provider_payment_id=entity['id']))
        db.commit()
    except GatewayError:
        db.rollback();raise HTTPException(503,'Notification reconciliation is pending. Retry later.') from None
    except IntegrityError:
        db.rollback();return {'received':True,'duplicate':True}
    return {'received':True}
