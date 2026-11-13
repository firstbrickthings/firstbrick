"""Owner-only unread order counts and moderated feedback from real purchases."""
import hashlib
from fastapi import APIRouter, Depends, HTTPException
from pydantic import Field
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session
from .auth import Identity, admin, identity
from .db import database
from .models import Customer, Order, OrderEvent, Payment, SiteReview, StoreDocument
from .schemas import Input
from uuid import uuid4

router = APIRouter(prefix='/api')


def private_key(prefix, uid):
    return prefix + hashlib.sha256(uid.encode()).hexdigest()


def confirmed_events():
    return select(OrderEvent.id, OrderEvent.order_id).join(Order).where(
        Order.kind == 'purchase', OrderEvent.status == 'Order Confirmed')


def activity(db, uid):
    cursor = db.get(StoreDocument, private_key('orders-seen:', uid))
    after = int(cursor.value.get('last_event_id', 0)) if cursor else 0
    events = confirmed_events().subquery()
    latest = db.execute(select(events.c.id, events.c.order_id).order_by(events.c.id.desc()).limit(1)).first()
    return {'new_count':db.scalar(select(func.count(func.distinct(events.c.order_id))).where(events.c.id > after)),
            'latest_event_id':latest.id if latest else 0, 'latest_order_id':latest.order_id if latest else None,
            'seen_event_id':after}


@router.get('/admin/order-activity')
def order_activity(user:Identity=Depends(admin), db:Session=Depends(database)):
    return activity(db, user.uid)


class SeenInput(Input):
    last_event_id:int=Field(ge=0, strict=True)


@router.put('/admin/order-activity')
def mark_seen(data:SeenInput, user:Identity=Depends(admin), db:Session=Depends(database)):
    latest = activity(db, user.uid)['latest_event_id']
    if data.last_event_id > latest:
        raise HTTPException(409, 'Refresh orders before marking them as viewed.')
    key = private_key('orders-seen:', user.uid)
    row = db.scalar(select(StoreDocument).where(StoreDocument.key == key).with_for_update())
    value = {'last_event_id':max(data.last_event_id, int(row.value.get('last_event_id', 0)) if row else 0)}
    if row:
        row.value = value
        row.version += 1
    else:
        db.add(StoreDocument(key=key, value=value, version=1))
    db.commit()
    return activity(db, user.uid)


def eligible_order(db, uid):
    return db.scalar(select(Order).outerjoin(Payment).where(
        Order.customer_uid == uid, Order.kind == 'purchase', Order.status != 'Cancelled',
        or_(Payment.status == 'paid', Order.status == 'Delivered')).order_by(Order.created_at.desc()).limit(1))


class CustomerReviewInput(Input):
    name:str=Field(min_length=2, max_length=100)
    message:str=Field(min_length=3, max_length=2000)
    rating:int=Field(ge=1, le=5, strict=True)


@router.post('/me/reviews', status_code=201)
def submit_review(data:CustomerReviewInput, user:Identity=Depends(identity), db:Session=Depends(database)):
    # Serialize one submission per verified account; the review stays private until moderated.
    db.scalar(select(Customer).where(Customer.uid == user.uid).with_for_update())
    order = eligible_order(db, user.uid)
    if not order:
        raise HTTPException(409, 'You can review BabyOne after a paid or delivered purchase. For a shop purchase, send your feedback to our WhatsApp.')
    key = private_key('customer-review:', user.uid)
    previous = db.get(StoreDocument, key)
    if previous and db.get(SiteReview, previous.value.get('review_id')):
        raise HTTPException(409, 'Your review is already saved. Contact BabyOne if you would like to update it.')
    row = SiteReview(id=str(uuid4()), name=data.name.strip(), message=data.message.strip(), rating=data.rating, published=False)
    if len(row.name) < 2 or len(row.message) < 3:
        raise HTTPException(422, 'Enter your name and a few words about your experience.')
    db.add(row)
    proof = {'review_id':row.id, 'order_id':order.id, 'verified_purchase':True}
    if previous:
        previous.value = proof
        previous.version += 1
    else:
        db.add(StoreDocument(key=key, value=proof, version=1))
    db.commit()
    return {'id':row.id, 'published':False, 'message':'Thank you. Your review is saved for the store to review before publishing.'}
