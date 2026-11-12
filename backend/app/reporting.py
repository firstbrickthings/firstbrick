"""Transactional outbox: an unavailable spreadsheet never rolls back an order."""
import asyncio
import hashlib
import hmac
import json
import logging
from datetime import timedelta
from urllib.request import Request, urlopen
from uuid import uuid4
from sqlalchemy import select
from .config import settings
from .db import sessions
from .models import ReportingEvent, now


def enqueue_order(db, order, kind):
    db.add(ReportingEvent(id=str(uuid4()),kind=kind,payload={
        'order_id':order.id,'status':order.status,'payment':order.payment,'total':str(order.total),
        'customer':{'phone':order.phone,**order.shipping},'items':order.items,
        'created_at':order.created_at.isoformat()+'Z' if order.created_at else now().isoformat()+'Z'}))


def drain():
    s=settings()
    if not (s.sheets_enabled and s.sheets_url and s.sheets_secret):return
    if not s.sheets_url.startswith('https://script.google.com/macros/s/') or not s.sheets_url.endswith('/exec'):
        logging.getLogger(__name__).error('Sheets reporting URL is not a deployed Apps Script endpoint');return
    for _ in range(10):
        with sessions()() as db:
            event=db.scalar(select(ReportingEvent).where(ReportingEvent.status=='pending',ReportingEvent.next_attempt<=now()).order_by(ReportingEvent.created_at).with_for_update(skip_locked=True).limit(1))
            if not event:return
            event.attempts+=1
            body=json.dumps({'event_id':event.id,'kind':event.kind,'payload':event.payload},sort_keys=True,separators=(',',':'))
            stamp=str(int(now().timestamp()))
            signature=hmac.new(s.sheets_secret.encode(),(stamp+'.'+body).encode(),hashlib.sha256).hexdigest()
            envelope=json.dumps({'timestamp':stamp,'body':body,'signature':signature}).encode()
            try:
                request=Request(s.sheets_url,data=envelope,headers={'Content-Type':'application/json'},method='POST')
                with urlopen(request,timeout=12) as response:
                    result=json.loads(response.read(8192))
                if result.get('ok') is not True or result.get('event_id')!=event.id:
                    raise ValueError('Receiver did not acknowledge the event ID')
                event.status='sent';event.last_error=''
            except Exception as error:
                # Do not log payloads, URLs containing credentials, secrets or full upstream responses.
                event.last_error=type(error).__name__+': no verified acknowledgement'
                event.next_attempt=now()+timedelta(seconds=min(86400,60*2**min(event.attempts,10)))
            db.commit()


async def worker():
    from starlette.concurrency import run_in_threadpool
    while True:
        try:await run_in_threadpool(drain)
        except Exception:logging.getLogger(__name__).exception('Reporting worker failed')
        await asyncio.sleep(45)
