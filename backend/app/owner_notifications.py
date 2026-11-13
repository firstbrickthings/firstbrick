"""Owner order emails use a separate durable channel in the existing outbox."""
import asyncio
import base64
import hashlib
import logging
from datetime import timedelta
from decimal import Decimal
from email.message import EmailMessage
from email.utils import formatdate
from html import escape
import requests
from cryptography.fernet import InvalidToken
from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from .auth import Identity, admin
from .config import settings
from .db import database, sessions
from .gmail_delivery import box, connected, missing_settings
from .models import GmailCredential, ReportingEvent, now

router = APIRouter(prefix='/api/admin/notifications/email')
KIND = 'owner_order_email'


class DeliveryError(Exception):
    def __init__(self, *, uncertain=False, retryable=False):
        self.uncertain = uncertain
        self.retryable = retryable
        super().__init__('Email delivery could not be verified.')


def enqueue_order(db, order):
    if order.kind != 'purchase' or order.status == 'Awaiting Payment':
        return
    identifier = 'owner-mail:' + hashlib.sha256(order.id.encode()).hexdigest()
    if db.get(ReportingEvent, identifier):
        return
    db.add(ReportingEvent(id=identifier, kind=KIND, next_attempt=now().replace(microsecond=0), payload={
        'order_id':order.id, 'status':order.status, 'items':order.items,
        'subtotal':str(order.subtotal), 'delivery':str(order.delivery), 'total':str(order.total),
        'payment':order.payment, 'customer':{**order.shipping, 'phone':order.phone}}))


def token(db):
    if not connected(db):
        raise DeliveryError()
    cfg = settings()
    try:
        credential = db.get(GmailCredential, cfg.auth_email_sender.lower())
        refresh = box().decrypt(credential.encrypted_refresh_token.encode()).decode()
        reply = requests.post('https://oauth2.googleapis.com/token', data={
            'client_id':cfg.gmail_oauth_client_id, 'client_secret':cfg.gmail_oauth_client_secret,
            'refresh_token':refresh, 'grant_type':'refresh_token'}, timeout=15)
        if reply.status_code != 200:
            raise DeliveryError(retryable=reply.status_code == 429 or reply.status_code >= 500)
        return reply.json()['access_token']
    except (requests.RequestException, ValueError, KeyError, InvalidToken):
        raise DeliveryError(retryable=True) from None


def message(event):
    p, recipient = event.payload, settings().auth_email_sender.lower()
    money = lambda value:'₹' + format(Decimal(str(value)), ',.2f')
    customer = p['customer']
    address = ', '.join(str(customer.get(k, '')) for k in ['address','city','state','pin'] if customer.get(k))
    lines = [f"{i['name']} × {i['qty']} — {money(Decimal(str(i['price'])) * i['qty'])}" for i in p['items']]
    text = '\n'.join(['New BabyOne order '+p['order_id'], '', *lines, '',
        'Subtotal: '+money(p['subtotal']), 'Delivery: '+money(p['delivery']), 'Order total: '+money(p['total']),
        'Payment: '+('Paid online' if p['payment'] == 'RAZORPAY' else 'Cash on delivery — collect on delivery'),
        'Customer: '+str(customer.get('name', 'Customer')), 'Phone: '+str(customer.get('phone', '')), 'Deliver to: '+address])
    msg = EmailMessage()
    msg['To'] = recipient
    msg['From'] = 'BabyOne <'+recipient+'>'
    msg['Subject'] = 'New order '+p['order_id']+' · '+money(p['total'])+' | BabyOne'
    msg['Message-ID'] = '<order-'+hashlib.sha256(event.id.encode()).hexdigest()+'@babyone-web-test.up.railway.app>'
    msg['Date'] = formatdate()
    msg.set_content(text)
    rows = ''.join('<tr><td style="padding:12px 0;border-bottom:1px solid #e2e8ef">'+escape(i['name'])+
                   '</td><td style="padding:12px;text-align:center">'+str(i['qty'])+
                   '</td><td style="padding:12px 0;text-align:right;white-space:nowrap">'+money(Decimal(str(i['price']))*i['qty'])+'</td></tr>' for i in p['items'])
    msg.add_alternative('<html><body style="font:15px Arial,sans-serif;color:#2b4054;background:#f5f7fb;padding:24px">'
        '<div style="max-width:620px;margin:auto;background:white;border:1px solid #dbe3ec;border-radius:20px;padding:28px">'
        '<p style="color:#a34473;letter-spacing:3px;font-size:11px">BABYONE · NEW ORDER</p><h1 style="font-size:25px">'+escape(p['order_id'])+'</h1>'
        '<p>'+escape('Paid online' if p['payment']=='RAZORPAY' else 'Cash on delivery · payment due')+'</p>'
        '<table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr><th style="text-align:left">Product</th><th>Qty</th><th style="text-align:right">Amount</th></tr></thead><tbody>'+rows+'</tbody></table>'
        '<p>Subtotal: '+money(p['subtotal'])+'<br>Delivery: '+money(p['delivery'])+'</p><h2 style="font-size:22px">Total '+money(p['total'])+'</h2>'
        '<h3 style="font-size:14px">Delivery details</h3><p>'+escape(str(customer.get('name', 'Customer')))+'<br>'+escape(str(customer.get('phone', '')))+'<br>'+escape(address)+'</p>'
        '<p style="font-size:11px;color:#697d8f">Order summary · Manage this order in your BabyOne dashboard.</p></div></body></html>', subtype='html')
    return msg


def send(db, event):
    access = token(db)  # Refresh failures happen before the send; those are safe to retry.
    raw = base64.urlsafe_b64encode(message(event).as_bytes()).decode()
    try:
        reply = requests.post('https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
                              headers={'Authorization':'Bearer '+access}, json={'raw':raw}, timeout=15)
    except requests.RequestException:
        raise DeliveryError(uncertain=True) from None
    if reply.status_code not in (200,201):
        raise DeliveryError(uncertain=reply.status_code >= 500, retryable=reply.status_code == 429)
    try:
        if not reply.json().get('id'):
            raise DeliveryError(uncertain=True)
    except ValueError:
        raise DeliveryError(uncertain=True) from None


def drain():
    if not settings().order_email_enabled:
        return
    for _ in range(5):
        with sessions()() as db:
            if not connected(db):
                return
            event = db.scalar(select(ReportingEvent).where(ReportingEvent.kind == KIND, ReportingEvent.status == 'pending',
                              ReportingEvent.next_attempt <= now()).order_by(ReportingEvent.created_at).with_for_update(skip_locked=True).limit(1))
            if not event:
                return
            if now()-event.created_at > timedelta(days=7):
                event.status = 'expired'
                db.commit()
                continue
            identifier = event.id
            event.status = 'processing'
            event.attempts += 1
            db.commit()  # A restart or lost response never silently sends the same email twice.
            try:
                send(db, event)
                event.status, event.last_error = 'sent', ''
            except DeliveryError as error:
                event.status = 'uncertain' if error.uncertain else 'pending' if error.retryable and event.attempts < 5 else 'failed'
                event.last_error = 'Delivery unconfirmed; review before resending.' if error.uncertain else 'Mailbox connection or provider needs attention.'
                event.next_attempt = now()+timedelta(seconds=min(3600,60*2**event.attempts))
            except Exception:
                event.status, event.last_error = 'uncertain', 'Delivery unconfirmed; review before resending.'
            db.commit()


async def worker():
    from starlette.concurrency import run_in_threadpool
    while True:
        try:
            await run_in_threadpool(drain)
        except Exception:
            logging.getLogger(__name__).error('Owner email worker needs attention.')
        await asyncio.sleep(20)


@router.get('')
def status(user:Identity=Depends(admin), db:Session=Depends(database)):
    counts = dict(db.execute(select(ReportingEvent.status,func.count()).where(ReportingEvent.kind == KIND).group_by(ReportingEvent.status)).all())
    rows = db.scalars(select(ReportingEvent).where(ReportingEvent.kind == KIND).order_by(ReportingEvent.created_at.desc()).limit(20))
    return {'enabled':settings().order_email_enabled, 'connected':connected(db), 'missing':missing_settings(),
            'recipient':settings().auth_email_sender.lower(), 'counts':counts,
            'messages':[{'order_id':row.payload['order_id'], 'status':row.status, 'attempts':row.attempts, 'last_error':row.last_error} for row in rows]}


@router.get('/check')
def check(user:Identity=Depends(admin), db:Session=Depends(database)):
    if not connected(db):
        return {'ready':False, 'message':'Connect the store Gmail account in Login & email first.'}
    try:
        token(db)
        return {'ready':settings().order_email_enabled, 'message':'Mailbox authorization verified. No email was sent.'}
    except DeliveryError:
        return {'ready':False, 'message':'Google could not verify the mailbox connection. Reconnect the store Gmail account.'}
