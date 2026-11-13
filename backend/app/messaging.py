"""Opt-in WhatsApp Cloud API messages, durable queue and signed provider callbacks."""
import asyncio
import hashlib
import hmac
import json
import re
import time
from datetime import timedelta, timezone
from urllib.error import HTTPError
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from uuid import uuid4
from fastapi import APIRouter, Depends, HTTPException, Query, Request as WebRequest
from fastapi.responses import PlainTextResponse
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session
from .auth import Identity, admin, identity
from .config import settings
from .db import database, sessions
from .models import Customer, CustomerCart, Order, WhatsAppMessage, WhatsAppPreference, now
from .schemas import Input

router=APIRouter(prefix='/api')


def event_key(*parts):return hashlib.sha256('|'.join(parts).encode()).hexdigest()


def missing_configuration():
    s=settings()
    names=['whatsapp_access_token','whatsapp_phone_number_id','whatsapp_app_secret','whatsapp_verify_token','whatsapp_graph_version','cart_link_secret']
    missing=[name.upper() for name in names if not getattr(s,name)]
    if s.whatsapp_phone_number_id and not s.whatsapp_phone_number_id.isdigit():missing.append('VALID_WHATSAPP_PHONE_NUMBER_ID')
    if s.whatsapp_graph_version and not re.fullmatch(r'v\d+\.\d+',s.whatsapp_graph_version):missing.append('VALID_WHATSAPP_GRAPH_VERSION')
    if s.cart_link_secret and len(s.cart_link_secret)<32:missing.append('STRONG_CART_LINK_SECRET')
    if not s.public_store_url.startswith('https://'):missing.append('HTTPS_PUBLIC_STORE_URL')
    return missing


def enqueue_order(db,order):
    preference=db.get(WhatsAppPreference,order.customer_uid)
    if not preference or not preference.order_updates or order.status=='Awaiting Payment':return
    key=event_key('order',order.id,order.status)
    if db.scalar(select(WhatsAppMessage.id).where(WhatsAppMessage.event_key==key)):return
    db.add(WhatsAppMessage(id=str(uuid4()),customer_uid=order.customer_uid,event_key=key,kind='order_update',order_id=order.id,payload={
        'name':order.shipping.get('name','Customer'),'order_id':order.id,'status':order.status,'total':str(order.total),
        'items':', '.join(f"{i['name']} × {i['qty']}" for i in order.items)[:600]},due_at=now().replace(microsecond=0)))


def recovery_link(message):
    s=settings();expires=int((message.created_at.replace(tzinfo=timezone.utc)+timedelta(days=2)).timestamp())
    signature=hmac.new(s.cart_link_secret.encode(),f'{message.id}|{message.cart_version}|{expires}'.encode(),hashlib.sha256).hexdigest()
    return s.public_store_url.rstrip('/')+'/?'+urlencode({'recover_cart':message.id,'expires':expires,'signature':signature})


@router.get('/me/cart/recover')
def recover_cart(message_id:str=Query(...,pattern=r'^[a-f0-9-]{36}$'),expires:int=Query(...,gt=0),signature:str=Query(...,pattern=r'^[a-f0-9]{64}$'),user:Identity=Depends(identity),db:Session=Depends(database)):
    row=db.get(WhatsAppMessage,message_id)
    if not row or row.customer_uid!=user.uid or row.kind!='cart_reminder':raise HTTPException(404,'Saved bag not found.')
    if not settings().cart_link_secret:raise HTTPException(503,'Saved bag links are not configured yet.')
    expected=hmac.new(settings().cart_link_secret.encode(),f'{row.id}|{row.cart_version}|{expires}'.encode(),hashlib.sha256).hexdigest()
    maximum=int((row.created_at.replace(tzinfo=timezone.utc)+timedelta(days=2)).timestamp())
    if expires!=maximum or expires<int(time.time()) or not hmac.compare_digest(expected,signature):raise HTTPException(410,'This bag link expired. Open your current saved bag from your account.')
    from .carts import cart_view
    cart=db.get(CustomerCart,user.uid)
    result=cart_view(db,cart);result['cart_changed']=not cart or cart.version!=row.cart_version
    return result


_connection={'key':'','checked_at':0,'ready':False,'message':'Awaiting WhatsApp account setup.'}


def check_connection(force=False):
    s=settings()
    if missing_configuration():return {'ready':False,'message':'WhatsApp account variables are incomplete.'}
    key=event_key(s.whatsapp_access_token,s.whatsapp_phone_number_id,s.whatsapp_graph_version)
    if not force and _connection['key']==key and time.time()-_connection['checked_at']<300:
        return {k:_connection[k] for k in ['ready','message']}
    ready=False;message='Could not verify the store sender. Check the account variables.'
    try:
        request=Request(f'https://graph.facebook.com/{s.whatsapp_graph_version}/{s.whatsapp_phone_number_id}?fields=display_phone_number,verified_name',headers={'Authorization':'Bearer '+s.whatsapp_access_token})
        with urlopen(request,timeout=10) as response:result=json.loads(response.read(8192))
        phone=''.join(c for c in str(result.get('display_phone_number','')) if c.isdigit())
        ready=phone=='917034476592';message='Store sender verified.' if ready else 'The API sender is not the configured store number 7034476592.'
    except Exception:pass
    _connection.update(key=key,checked_at=time.time(),ready=ready,message=message)
    return {'ready':ready,'message':message}


def provider_call(body):
    s=settings();endpoint=f'https://graph.facebook.com/{s.whatsapp_graph_version}/{s.whatsapp_phone_number_id}/messages'
    request=Request(endpoint,data=json.dumps(body).encode(),headers={'Authorization':'Bearer '+s.whatsapp_access_token,'Content-Type':'application/json'},method='POST')
    with urlopen(request,timeout=12) as response:return json.loads(response.read(16384))


def build_template(db,message,customer,preference,cart):
    s=settings()
    if message.kind=='cart_reminder':
        if not preference.cart_reminders or not cart or cart.ordered_at or not cart.items or cart.version!=message.cart_version:return None
        if now()-cart.updated_at<timedelta(minutes=20):return None
        if now()-message.created_at>timedelta(days=1):return None
        # An order placed after this cart activity cancels the reminder even when its cart was saved elsewhere.
        if db.scalar(select(Order.id).where(Order.customer_uid==customer.uid,Order.created_at>=cart.updated_at).limit(1)):return None
        from .carts import cart_view
        view=cart_view(db,cart)
        names=', '.join(f"{line['name']} × {line['quantity']}" for line in view['items'])[:600]
        link=recovery_link(message);values=[customer.details.get('name','Customer'),names,'₹'+view['subtotal']]
        button=link.split('/?',1)[1];template=s.whatsapp_cart_template
    else:
        if not preference.order_updates:return None
        order=db.get(Order,message.order_id)
        if not order or order.status!=message.payload.get('status') or now()-message.created_at>timedelta(days=2):return None
        p=message.payload;values=[p.get('name','Customer'),p['order_id'],p['status'],p['items'],'₹'+p['total']]
        button='?track='+p['order_id'];template=s.whatsapp_order_template
    return {'messaging_product':'whatsapp','recipient_type':'individual','to':preference.phone.removeprefix('+'),
            'type':'template','biz_opaque_callback_data':message.id,
            'template':{'name':template,'language':{'code':s.whatsapp_language},'components':[
                {'type':'body','parameters':[{'type':'text','text':str(value).replace('\n',' ')[:700]} for value in values]},
                {'type':'button','sub_type':'url','index':'0','parameters':[{'type':'text','text':button}]}]}}


def drain():
    if not settings().whatsapp_enabled or missing_configuration() or not check_connection()['ready']:return
    with sessions()() as db:
        ids=list(db.scalars(select(WhatsAppMessage.id).where(WhatsAppMessage.status=='pending',WhatsAppMessage.due_at<=now()).order_by(WhatsAppMessage.due_at).limit(10)))
    for identifier in ids:
        # Phase one records the send intent durably. Processing events are never blindly retried.
        with sessions()() as db:
            initial=db.get(WhatsAppMessage,identifier)
            if not initial:continue
            customer=db.scalar(select(Customer).where(Customer.uid==initial.customer_uid).with_for_update())
            cart=db.get(CustomerCart,initial.customer_uid);preference=db.get(WhatsAppPreference,initial.customer_uid)
            row=db.scalar(select(WhatsAppMessage).where(WhatsAppMessage.id==identifier).with_for_update().execution_options(populate_existing=True))
            if not row or row.status!='pending' or row.due_at>now():continue
            body=build_template(db,row,customer,preference,cart) if customer and preference else None
            if body is None:row.status='cancelled';db.commit();continue
            row.attempts+=1;row.status='processing';db.commit()
            uid=row.customer_uid
        # Phase two rechecks cart/consent after the durable intent and locks them through the bounded send.
        with sessions()() as db:
            customer=db.scalar(select(Customer).where(Customer.uid==uid).with_for_update())
            cart=db.get(CustomerCart,uid);preference=db.get(WhatsAppPreference,uid)
            row=db.scalar(select(WhatsAppMessage).where(WhatsAppMessage.id==identifier).with_for_update())
            if row.status!='processing':continue
            body=build_template(db,row,customer,preference,cart) if customer and preference else None
            if body is None:row.status='cancelled';db.commit();continue
            try:
                result=provider_call(body);provider_id=(result.get('messages') or [{}])[0].get('id')
                if not provider_id:raise ValueError('Provider did not acknowledge message')
                row.provider_id=provider_id;row.status='accepted';row.last_error=''
            except HTTPError as error:
                if error.code==429 and row.attempts<5:
                    row.status='pending';row.due_at=now()+timedelta(minutes=2**row.attempts);row.last_error='Provider rate limit; retry scheduled.'
                else:
                    row.status='uncertain' if error.code>=500 else 'failed';row.last_error=f'Provider HTTP {error.code}; check connection/templates.'
            except Exception:
                row.status='uncertain';row.last_error='Delivery unconfirmed; automatic resend paused to prevent duplicates.'
            db.commit()


async def worker():
    from starlette.concurrency import run_in_threadpool
    while True:
        try:await run_in_threadpool(drain)
        except Exception:
            import logging
            logging.getLogger(__name__).error('WhatsApp worker failed; queued messages retained.')
        await asyncio.sleep(20)


@router.get('/webhooks/whatsapp')
def verify_webhook(mode:str=Query('',alias='hub.mode'),token:str=Query('',alias='hub.verify_token'),challenge:str=Query('',alias='hub.challenge')):
    expected=settings().whatsapp_verify_token
    if mode!='subscribe' or not expected or not hmac.compare_digest(token,expected):raise HTTPException(403,'Webhook verification failed.')
    return PlainTextResponse(challenge)


@router.post('/webhooks/whatsapp')
async def callback(request:WebRequest,db:Session=Depends(database)):
    raw=await request.body();secret=settings().whatsapp_app_secret
    expected='sha256='+hmac.new(secret.encode(),raw,hashlib.sha256).hexdigest() if secret else ''
    if not expected or not hmac.compare_digest(request.headers.get('x-hub-signature-256',''),expected):raise HTTPException(403,'Invalid webhook signature.')
    try:data=json.loads(raw)
    except ValueError:raise HTTPException(400,'Invalid callback.') from None
    if data.get('object')!='whatsapp_business_account':return {'ok':True}
    rank={'processing':0,'uncertain':0,'accepted':0,'sent':1,'delivered':2,'read':3}
    for entry in data.get('entry',[]):
        for change in entry.get('changes',[]):
            value=change.get('value',{})
            if str(value.get('metadata',{}).get('phone_number_id',''))!=settings().whatsapp_phone_number_id:continue
            for message in value.get('messages',[]):
                text=message.get('text',{}).get('body','') or message.get('button',{}).get('payload','') or message.get('interactive',{}).get('button_reply',{}).get('id','')
                if str(text).strip().lower() not in {'stop','unsubscribe','stop promotions','stop_updates'}:continue
                phone='+'+str(message.get('from','')).removeprefix('+')
                uids=list(db.scalars(select(WhatsAppPreference.customer_uid).where(WhatsAppPreference.phone==phone)))
                for uid in uids:
                    db.scalar(select(Customer).where(Customer.uid==uid).with_for_update())
                    pref=db.get(WhatsAppPreference,uid);pref.order_updates=False;pref.cart_reminders=False
                    for event in db.scalars(select(WhatsAppMessage).where(WhatsAppMessage.customer_uid==uid,WhatsAppMessage.status=='pending').with_for_update()):event.status='cancelled'
            for event in value.get('statuses',[]):
                provider_id=event.get('id');opaque=event.get('biz_opaque_callback_data','')
                row=db.scalar(select(WhatsAppMessage).where(or_(WhatsAppMessage.provider_id==provider_id,WhatsAppMessage.id==opaque)).with_for_update()) if provider_id else None
                if not row:continue
                if row.provider_id and row.provider_id!=provider_id:continue
                state=event.get('status')
                if state in {'sent','delivered','read'} and rank.get(state,-1)>=rank.get(row.status,-1):row.status=state;row.provider_id=provider_id;row.last_error=''
                elif state=='failed' and row.status not in {'delivered','read'}:row.status='failed';row.last_error='Provider reported failure; review message settings.'
    db.commit();return {'ok':True}


@router.get('/admin/whatsapp')
def admin_status(user:Identity=Depends(admin),db:Session=Depends(database)):
    counts=dict(db.execute(select(WhatsAppMessage.status,func.count()).group_by(WhatsAppMessage.status)).all())
    rows=db.scalars(select(WhatsAppMessage).order_by(WhatsAppMessage.created_at.desc()).limit(50))
    return {'enabled':settings().whatsapp_enabled,'configured':not missing_configuration(),'missing':missing_configuration(),
            'counts':counts,'sender':'+917034476592','webhook':settings().public_store_url.rstrip('/')+'/api/webhooks/whatsapp',
            'connection':check_connection() if settings().whatsapp_enabled else {'ready':False,'message':'Automatic sending is disabled.'},
            'templates':{'cart':settings().whatsapp_cart_template,'order':settings().whatsapp_order_template,'language':settings().whatsapp_language},
            'messages':[{'id':r.id,'kind':r.kind,'status':r.status,'order_id':r.order_id,'attempts':r.attempts,'last_error':r.last_error,
                         'due_at':r.due_at.isoformat()+'Z','updated_at':r.updated_at.isoformat()+'Z'} for r in rows]}


@router.get('/store/contact')
def public_contact():
    return {'phone':'+917034476592','email':'babyonestores@gmail.com','whatsapp_automation_active':settings().whatsapp_enabled and not missing_configuration() and _connection['ready']}


@router.get('/admin/whatsapp/check')
def check_account(user:Identity=Depends(admin)):
    return check_connection(force=True)
