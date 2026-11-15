"""Owner-only payment reporting. Reads website records; never changes gateway mode."""
from datetime import timedelta, timezone
from typing import Literal
from zoneinfo import ZoneInfo
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import case, func, select
from sqlalchemy.orm import Session
from .auth import Identity, admin
from .db import database
from .models import Order, Payment, now

router = APIRouter(prefix='/api/admin/payments')
IST = ZoneInfo('Asia/Kolkata')


@router.get('/overview')
def overview(mode: Literal['live', 'test'] = 'live', days: int = Query(7, ge=1, le=30),
             user: Identity = Depends(admin), db: Session = Depends(database)):
    if days not in (1, 7, 30):
        raise HTTPException(422, 'Choose Today, 7 Days or 30 Days.')
    today = now().replace(tzinfo=timezone.utc).astimezone(IST).replace(hour=0, minute=0, second=0, microsecond=0)
    first = today-timedelta(days=days-1)
    start = first.astimezone(timezone.utc).replace(tzinfo=None)
    end = (today+timedelta(days=1)).astimezone(timezone.utc).replace(tzinfo=None)
    filters = (Payment.mode == mode, Payment.created_at >= start, Payment.created_at < end)
    paid = Payment.status == 'paid'
    pending = Payment.status.in_(['pending', 'created', 'authorized', 'verification_pending'])
    totals = db.execute(select(
        func.coalesce(func.sum(case((paid, Payment.amount_paise), else_=0)), 0),
        func.coalesce(func.sum(case((paid, 1), else_=0)), 0),
        func.coalesce(func.sum(case((pending, 1), else_=0)), 0)
    ).where(*filters)).one()
    local = func.convert_tz(Payment.created_at, '+00:00', '+05:30')
    bucket = func.date_format(local, '%Y-%m-%d %H:00' if days == 1 else '%Y-%m-%d')
    rows = db.execute(select(bucket.label('bucket'),
        func.sum(case((paid, Payment.amount_paise), else_=0)),
        func.sum(case((paid, 1), else_=0)),
        func.sum(case((pending, 1), else_=0))
    ).where(*filters).group_by(bucket)).all()
    grouped = {row[0]: row[1:] for row in rows}
    timeline = []
    for index in range(24 if days == 1 else days):
        stamp = first+(timedelta(hours=index) if days == 1 else timedelta(days=index))
        key = stamp.strftime('%Y-%m-%d %H:00' if days == 1 else '%Y-%m-%d')
        values = grouped.get(key, (0, 0, 0))
        timeline.append({'label': stamp.strftime('%H:00' if days == 1 else '%d %b'),
                         'collected_paise': int(values[0]), 'successful': int(values[1]), 'pending': int(values[2])})
    recent = db.execute(select(Payment, Order.kind).join(Order, Order.id == Payment.order_id)
                        .where(*filters).order_by(Payment.created_at.desc(), Payment.id.desc()).limit(25)).all()
    return {'mode': mode, 'days': days, 'source': 'website_records',
            'totals': {'collected_paise': int(totals[0]), 'successful': int(totals[1]), 'pending': int(totals[2])},
            'timeline': timeline,
            'recent': [{'order_id': payment.order_id, 'amount_paise': payment.amount_paise,
                        'status': payment.status, 'kind': kind,
                        'created_at': payment.created_at.replace(tzinfo=timezone.utc).isoformat()}
                       for payment, kind in recent],
            'note': 'Website payment records, including gateway checks. Bank settlements and refunds are managed in Razorpay.'}
