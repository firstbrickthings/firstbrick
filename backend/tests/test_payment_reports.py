"""Read-only dashboard reports use isolated MySQL data, never a gateway call."""
from datetime import datetime
from decimal import Decimal
from sqlalchemy import func, select
from app import payment_reports
from app.config import settings
from app.db import sessions
from app.models import Order, Payment, Variant
from conftest import headers


def test_payment_reports_require_owner_and_validate_filters(client):
    path='/api/admin/payments/overview'
    assert client.get(path).status_code==401
    assert client.get(path,headers=headers()).status_code==403
    for suffix in ['?mode=other','?days=2','?days=0','?days=31']:
        assert client.get(path+suffix,headers=headers('owner')).status_code==422
    data=client.get(path,headers=headers('owner')).json()
    assert data['totals']=={'collected_paise':0,'successful':0,'pending':0}
    assert data['recent']==[] and len(data['timeline'])==7
    assert data['source']=='website_records'


def test_reports_separate_modes_use_ist_boundaries_and_never_modify_data(client,monkeypatch):
    monkeypatch.setattr(payment_reports,'now',lambda:datetime(2026,1,2,2,0))
    client.post('/api/me/register',headers=headers()).raise_for_status()
    rows=[('live-paid',100,'paid','live',datetime(2026,1,1,19,0),'gateway_check'),
          ('test-paid',500,'paid','test',datetime(2026,1,2,0,0),'purchase'),
          ('live-pending',250,'pending','live',datetime(2026,1,2,1,0),'purchase'),
          ('live-failed',400,'failed','live',datetime(2026,1,2,1,30),'purchase'),
          ('live-old',999,'paid','live',datetime(2026,1,1,18,29),'purchase')]
    with sessions()() as db:
        for index,(key,amount,status,mode,stamp,kind) in enumerate(rows):
            value=Decimal(amount)/100
            order=Order(id='BO-REPORT-'+key,customer_uid='customer-uid',idempotency_key=key,request_hash=str(index).zfill(64),phone='+919999999999',shipping={},items=[],subtotal=value,delivery=0,delivery_breakdown=[],total=value,payment='RAZORPAY',kind=kind,status='Payment Verified' if status=='paid' else 'Awaiting Payment',created_at=stamp)
            db.add(order);db.flush();db.add(Payment(order_id=order.id,amount_paise=amount,currency='INR',mode=mode,status=status,key_id='fixture-key-must-not-leak',created_at=stamp))
        db.commit()
        before=[(p.id,p.mode,p.status,p.amount_paise) for p in db.scalars(select(Payment).order_by(Payment.id))]
    mode_before=settings().razorpay_mode
    def get(mode,days):
        response=client.get(f'/api/admin/payments/overview?mode={mode}&days={days}',headers=headers('owner'));assert response.status_code==200,response.text;return response.json()
    live=get('live',1)
    assert live['totals']=={'collected_paise':100,'successful':1,'pending':1}
    assert len(live['timeline'])==24 and live['timeline'][0]['collected_paise']==100
    assert live['recent'][-1]['kind']=='gateway_check'
    assert get('test',1)['totals']=={'collected_paise':500,'successful':1,'pending':0}
    assert get('live',7)['totals']=={'collected_paise':1099,'successful':2,'pending':1}
    assert 'fixture-key-must-not-leak' not in str(live)
    assert settings().razorpay_mode==mode_before
    with sessions()() as db:
        assert [(p.id,p.mode,p.status,p.amount_paise) for p in db.scalars(select(Payment).order_by(Payment.id))]==before
        assert db.scalar(select(func.count()).select_from(Order))==len(rows)
        assert db.get(Variant,'sku-bottle').stock==5
