"""Razorpay mode-pinned adapter. Secrets and card details never reach store responses/logs."""
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
    def __init__(self, uncertain=True, status=None):
        self.uncertain=uncertain
        self.status=status


class Gateway:
    def __init__(self,mode=None):
        config=settings();self.mode=mode or config.razorpay_mode
        if not config.payment_keys_configured(self.mode):
            raise HTTPException(503,'The payment credentials for this order are not configured.')
        self.key_id,self.secret=config.payment_keys(self.mode)

    def call(self, method, path, data=None):
        auth=base64.b64encode((self.key_id+':'+self.secret).encode()).decode()
        req=urllib.request.Request('https://api.razorpay.com/v1'+path,
            data=json.dumps(data).encode() if data is not None else None,method=method,
            headers={'Authorization':'Basic '+auth,'Content-Type':'application/json','User-Agent':'BabyOne/1.0'})
        try:
            with urllib.request.urlopen(req,timeout=12) as response:
                return json.load(response)
        except urllib.error.HTTPError as error:
            # Do not expose provider payloads, headers or credentials to logs/clients.
            raise GatewayError(uncertain=error.code>=500,status=error.code) from None
        except (OSError,ValueError):
            raise GatewayError() from None


@lru_cache(maxsize=4)
def upi_availability(public_key, minute, mode='test'):
    try:
        methods=Gateway(mode).call('GET','/methods?'+urllib.parse.urlencode({'key_id':public_key}))
        return methods.get('upi') if isinstance(methods,dict) and isinstance(methods.get('upi'),bool) else None
    except (GatewayError,HTTPException):return None


_live_connection={'fingerprint':'','credentials_verified':False,'webhook_ready':False,'message':'Live connection has not been checked.'}
LIVE_EVENTS={'payment.authorized','payment.captured','payment.failed','order.paid'}


def live_fingerprint():
    cfg=settings()
    return hashlib.sha256('|'.join([*cfg.payment_keys('live'),cfg.razorpay_live_webhook_secret,cfg.public_store_url]).encode()).hexdigest()


def live_setup():
    if _live_connection['fingerprint']!=live_fingerprint():return {'credentials_verified':False,'webhook_ready':False,'message':'Live connection has not been checked.'}
    return {k:_live_connection[k] for k in ['credentials_verified','webhook_ready','message']}


def prepare_live_connection():
    """Authenticate without charging; register only this store's dedicated live callback."""
    cfg=settings();state={'fingerprint':live_fingerprint(),'credentials_verified':False,'webhook_ready':False,'message':'Live keys are missing or invalid.'}
    try:
        gateway=Gateway('live')
        gateway.call('GET','/orders?count=1')  # Read-only authentication check; no order/payment is created.
        state.update(credentials_verified=True,message='Live keys verified. Complete the live webhook setup.')
        if cfg.razorpay_live_webhook_confirmed and cfg.razorpay_live_webhook_secret:
            state.update(webhook_ready=True,message='Live keys verified; live webhook confirmed by the store owner.')
        elif cfg.razorpay_prepare_live and cfg.razorpay_live_webhook_secret and cfg.public_store_url.startswith('https://'):
            callback=cfg.public_store_url.rstrip('/')+'/api/payments/razorpay/webhook/live'
            found=[]
            for skip in range(0,1000,100):
                result=gateway.call('GET','/webhooks?'+urllib.parse.urlencode({'count':100,'skip':skip}))
                rows=result.get('items') if isinstance(result,dict) else None
                if not isinstance(rows,list):raise ValueError('Invalid webhook list')
                found.extend(row for row in rows if row.get('url')==callback)
                if len(rows)<100:break
            else:raise ValueError('Webhook list too large')
            if len(found)>1:raise ValueError('Duplicate store callbacks need review')
            body={'url':callback,'secret':cfg.razorpay_live_webhook_secret,'events':sorted(LIVE_EVENTS),'active':True,'alert_email':'babyonestores@gmail.com'}
            if found:
                identifier=found[0].get('id','')
                if not re.fullmatch(r'(?:hook_)?[A-Za-z0-9]+',identifier):raise ValueError('Invalid webhook ID')
                result=gateway.call('PUT','/webhooks/'+identifier,body)
            else:result=gateway.call('POST','/webhooks',body)
            if result.get('url')!=callback or result.get('active') is not True or not LIVE_EVENTS.issubset(set(result.get('events',[]))) or not result.get('secret_exists'):
                raise ValueError('Webhook acknowledgement incomplete')
            state.update(webhook_ready=True,message='Live keys verified and live webhook registered.')
    except GatewayError as error:
        if state['credentials_verified']:state['message']='Live keys verified. Add the live webhook in the Razorpay Dashboard.'
        else:state['message']='Live key verification failed. Check the matching Live Key ID and Secret in Railway.'
    except (HTTPException,ValueError,KeyError,TypeError):pass
    _live_connection.update(state)
    import logging
    logging.getLogger(__name__).warning('Razorpay setup: %s',state['message'])
    return live_setup()


def new_payments_enabled():
    cfg=settings()
    return cfg.payment_keys_configured() and (cfg.razorpay_mode=='test' or all(live_setup()[k] for k in ['credentials_verified','webhook_ready']))


def checkout_config():
    cfg=settings();mode=cfg.razorpay_mode;enabled=new_payments_enabled()
    upi=upi_availability(cfg.payment_keys()[0],int(time.monotonic()//60),mode) if enabled else False
    return {'razorpay_enabled':enabled,'razorpay_test_enabled':enabled and mode=='test','razorpay_live_enabled':enabled and mode=='live',
            'payment_mode':mode,'test_mode':mode=='test','upi_enabled':upi is True,
            'upi_availability':'unknown' if upi is None else ('available' if upi else 'unavailable'),
            'live_setup':live_setup()}


def gateway_for(payment):
    gateway=Gateway(payment.mode)
    if payment.key_id and payment.key_id!=gateway.key_id:raise HTTPException(409,'This order uses an earlier payment key. Contact the store to reconcile it before paying again.')
    return gateway


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
            'razorpay_payment_id':payment.provider_payment_id,'test_mode':payment.mode=='test','payment_mode':payment.mode}


def validate_provider_order(remote,order,payment):
    if (not re.fullmatch(r'order_[A-Za-z0-9]+',str(remote.get('id',''))) or
        remote.get('receipt')!=order.id or remote.get('amount')!=payment.amount_paise or
        remote.get('currency')!='INR' or remote.get('partial_payment') is True):
        raise HTTPException(502,'The payment order does not match your shop order.')


def begin(db,order_id,user):
    order=owned_order(db,order_id,user);payment=payment_for(db,order)
    if payment.status=='paid':
        return payment_view(order,payment)
    if payment.mode!=settings().razorpay_mode:raise HTTPException(409,'This order belongs to an earlier payment mode. It cannot be converted into a new real-money charge. Start a new order for a purchase.')
    if not new_payments_enabled():raise HTTPException(503,'Online payments are being configured. Please try again shortly.')
    gateway=gateway_for(payment)
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
                    'receipt':order.id,'partial_payment':False,'notes':{'store_order_id':order.id,'mode':payment.mode,'purpose':order.kind}})
            except GatewayError as error:
                order=owned_order(db,order_id,user);payment=payment_for(db,order)
                if not error.uncertain:payment.create_attempted=False
                db.commit()
                raise HTTPException(503,'Razorpay could not open checkout. Retry this same order; your bag is kept.') from None
            order=owned_order(db,order_id,user);payment=payment_for(db,order)
        validate_provider_order(remote,order,payment)
        payment.provider_order_id=remote['id'];db.commit()
    return {**payment_view(order,payment),'checkout':{'key':gateway.key_id,'order_id':payment.provider_order_id,
        'amount':payment.amount_paise,'currency':'INR','name':'BabyOne','description':'BabyOne one-time ₹10 payment check' if order.kind=='gateway_check' else 'BabyOne TEST payment' if payment.mode=='test' else 'BabyOne order '+order.id,
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
            if order.kind=='gateway_check':
                order.status='Payment Verified'
                db.add(OrderEvent(order_id=order.id,actor_uid='razorpay',status='Payment Verified'))
                return
            order.status='Order Confirmed'
            db.add(OrderEvent(order_id=order.id,actor_uid='razorpay',status='Order Confirmed'))
            from .reporting import enqueue_order
            enqueue_order(db,order,'payment_confirmed')
            from .messaging import enqueue_order as enqueue_whatsapp
            enqueue_whatsapp(db,order)
    elif remote.get('status')=='failed':payment.status='failed'
    elif remote.get('status')=='authorized':payment.status='authorized'


def verify(db,order_id,user,data):
    order=owned_order(db,order_id,user);payment=payment_for(db,order);gateway=gateway_for(payment)
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
    order=owned_order(db,order_id,user);payment=payment_for(db,order)
    if payment.status!='paid' and payment.provider_order_id:
        gateway=gateway_for(payment)
        try:
            rows=gateway.call('GET','/orders/'+payment.provider_order_id+'/payments')['items']
            # A delayed failure can never downgrade an already captured payment.
            rows.sort(key=lambda row: {'failed':0,'authorized':1,'captured':2}.get(row.get('status'),0))
            for remote in rows:apply_payment(db,order,payment,remote,gateway)
            db.commit()
        except GatewayError:
            db.rollback();raise HTTPException(503,'Payment status is temporarily unavailable. Please check again.') from None
    return payment_view(order,payment)


def webhook(db,body,signature,event_id,mode='test'):
    secret=settings().razorpay_live_webhook_secret if mode=='live' else settings().razorpay_webhook_secret
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
    if not payment or payment.mode!=mode:return {'received':True,'matched':False}
    order=db.scalar(select(Order).where(Order.id==payment.order_id).with_for_update())
    payment=payment_for(db,order)
    event_hash=hashlib.sha256((mode+'|'+(event_id or hashlib.sha256(body).hexdigest())).encode()).hexdigest()
    if db.get(PaymentEvent,event_hash):return {'received':True,'duplicate':True}
    try:
        # Fetch provider state too; a signed notification alone cannot change the expected amount/order.
        gateway=gateway_for(payment)
        entity=gateway.call('GET','/payments/'+remote.get('id',''))
        apply_payment(db,order,payment,entity,gateway)
        db.add(PaymentEvent(event_id=event_hash,event_type=event_type,provider_payment_id=entity['id']))
        db.commit()
    except GatewayError:
        db.rollback();raise HTTPException(503,'Notification reconciliation is pending. Retry later.') from None
    except IntegrityError:
        db.rollback();return {'received':True,'duplicate':True}
    return {'received':True}
