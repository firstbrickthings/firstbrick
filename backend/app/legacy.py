"""Explicit owner review of device-only historical orders, without inventing payments or stock movements."""
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from pydantic import Field
from sqlalchemy import select
from sqlalchemy.orm import Session
from .auth import Identity, admin
from .db import database
from .models import Order, StoreDocument
from .schemas import Input, Money
from .services import TRANSITIONS, digest

router=APIRouter(prefix='/api/admin/import')
PREFIX='legacy-order:'


class LegacyItem(Input):
    id: str = Field(default='',max_length=191)
    name: str = Field(min_length=1,max_length=500)
    image: str = Field(default='',max_length=2000)
    price: Money
    qty: int = Field(ge=1,le=100,strict=True)
    size: str = Field(default='',max_length=191)


class LegacyInput(Input):
    id: str = Field(pattern=r'^[A-Za-z0-9_-]{1,70}$')
    dateISO: datetime
    name: str = Field(min_length=2,max_length=100)
    phone: str = Field(pattern=r'^\+?91[0-9]{10}$|^[0-9]{10}$')
    address: str = Field(default='',max_length=500)
    city: str = Field(default='',max_length=100)
    state: str = Field(default='',max_length=100)
    pin: str = Field(default='',pattern=r'^$|^[1-9][0-9]{5}$')
    email: str = Field(default='',max_length=254)
    items: list[LegacyItem] = Field(min_length=1,max_length=100)
    subtotal: Money
    delivery: Money
    total: Money
    status: str = Field(max_length=40)
    confirmed: bool


def view(row):
    data={**row.value,'legacy_import':True,'payment':'LEGACY','payment_status':'historical_unverified',
          'allowed_next_statuses':sorted(TRANSITIONS.get(row.value['status'],set())),
          'date':row.value['dateISO'], 'updatedAtISO':row.updated_at.replace(tzinfo=timezone.utc).isoformat()}
    data.pop('import_hash',None)
    data.pop('verified_phone',None)
    return data


def find(db,order_id,phone=None):
    row=db.get(StoreDocument,PREFIX+order_id)
    if not row or (phone and row.value.get('verified_phone')!=phone):
        raise HTTPException(404,'Order not found.')
    return row


def list_orders(db,phone=None):
    rows=db.scalars(select(StoreDocument).where(StoreDocument.key.startswith(PREFIX,autoescape=True)))
    return [view(row) for row in rows if not phone or row.value.get('verified_phone')==phone]


def change(db,order_id,status):
    row=db.scalar(select(StoreDocument).where(StoreDocument.key==PREFIX+order_id).with_for_update())
    if not row:raise HTTPException(404,'Order not found.')
    current=row.value['status']
    if status!=current and status not in TRANSITIONS.get(current,set()):
        raise HTTPException(409,'This status transition is not allowed.')
    row.value={**row.value,'status':status};row.version+=1
    # Historical imports never reserve/restock inventory or assert a captured gateway payment.
    db.commit();return view(row)


@router.post('/legacy-order')
def import_order(data: LegacyInput,user: Identity=Depends(admin),db: Session=Depends(database)):
    if not data.confirmed:raise HTTPException(422,'Review and confirm the historical order before importing.')
    if data.status not in TRANSITIONS:raise HTTPException(422,'Choose a recognised fulfilment status.')
    if data.subtotal+data.delivery!=data.total:raise HTTPException(422,'Historical subtotal plus delivery must equal the original total.')
    if db.get(Order,data.id):raise HTTPException(409,'This order is already in the main order database. It was not replaced.')
    request_hash=digest(data.model_dump(mode='json'))
    existing=db.get(StoreDocument,PREFIX+data.id)
    if existing:
        if existing.value.get('import_hash')==request_hash:return view(existing)
        raise HTTPException(409,'This historical order was already imported. It was not replaced.')
    phone=data.phone.removeprefix('+');phone='+91'+phone if len(phone)==10 else '+'+phone
    stamp=data.dateISO
    if stamp.tzinfo is None:raise HTTPException(422,'Use the original order date with its timezone.')
    if stamp>datetime.now(timezone.utc):raise HTTPException(422,'A historical order cannot have a future date.')
    # Reject executable URLs even for owner-imported data; all other text is escaped by the UI.
    from .workspace import safe_url
    if any(item.image and not safe_url(item.image) for item in data.items):raise HTTPException(422,'Choose safe website image URLs before importing.')
    value=data.model_dump(mode='json',exclude={'confirmed'})
    value.update(verified_phone=phone,phone=phone.removeprefix('+91'),payment='LEGACY',currency='INR',
                 dateISO=stamp.astimezone(timezone.utc).isoformat(),import_hash=request_hash,deliveryBreakdown=[{'category':'Original recorded delivery','rate':str(data.delivery)}])
    row=StoreDocument(key=PREFIX+data.id,value=value,version=1)
    db.add(row);db.commit();return view(row)
