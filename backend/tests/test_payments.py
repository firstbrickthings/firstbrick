import hashlib
import hmac
import json
import pytest
from fastapi import HTTPException
from sqlalchemy import func,select
from app import payments
from app.config import settings
from app.db import sessions
from app.models import Order,OrderEvent,Payment,PaymentEvent,Variant
from conftest import headers
from test_store import payload


class FakeGateway:
    key_id='rzp_test_fake'
    secret='unit-test-secret-not-a-credential'
    def __init__(self):
        self.orders={};self.entities={};self.creates=0;self.captures=0;self.lose_response=False
    def call(self,method,path,data=None):
        if method=='POST' and path=='/orders':
            self.creates+=1;entity={**data,'id':'order_test'+str(self.creates)};self.orders[entity['id']]=entity
            if self.lose_response:self.lose_response=False;raise payments.GatewayError()
            return entity
        if path.startswith('/orders?'):
            return {'items':list(self.orders.values())}
        if path.startswith('/orders/') and path.endswith('/payments'):
            order_id=path.split('/')[2];return {'items':[p for p in self.entities.values() if p['order_id']==order_id]}
        if path.startswith('/payments/'):
            payment_id=path.split('/')[2];entity=self.entities[payment_id]
            if method=='POST':entity.update(status='captured',captured=True);self.captures+=1
            return entity.copy()
        raise AssertionError((method,path))


@pytest.fixture
def gateway(monkeypatch):
    fake=FakeGateway();monkeypatch.setattr(payments,'Gateway',lambda:fake)
    monkeypatch.setattr(settings(),'razorpay_webhook_secret','unit-webhook-secret')
    return fake


def start(client,gateway):
    data=payload(client);data['payment']='RAZORPAY'
    response=client.post('/api/orders',json=data,headers=headers());assert response.status_code==200,response.text
    order=response.json();assert order['status']=='Awaiting Payment';assert order['payment_status']=='pending'
    response=client.post('/api/payments/razorpay/'+order['id']+'/checkout',headers=headers());assert response.status_code==200,response.text
    return order,response.json()


def callback(gateway,checkout,payment_id='pay_test1',status='authorized'):
    oid=checkout['razorpay_order_id']
    gateway.entities[payment_id]={'id':payment_id,'order_id':oid,'amount':checkout['checkout']['amount'],'currency':'INR','status':status,'captured':status=='captured'}
    signature=hmac.new(gateway.secret.encode(),(oid+'|'+payment_id).encode(),hashlib.sha256).hexdigest()
    return {'razorpay_order_id':oid,'razorpay_payment_id':payment_id,'razorpay_signature':signature}


def test_verified_payment_captures_and_records_once(client,gateway):
    order,checkout=start(client,gateway);data=callback(gateway,checkout)
    assert 'key_secret' not in json.dumps(checkout)
    response=client.post('/api/payments/razorpay/'+order['id']+'/verify',json=data,headers=headers())
    assert response.status_code==200,response.text
    assert response.json()['payment_status']=='paid'
    assert response.json()['order']['status']=='Order Confirmed'
    assert client.post('/api/payments/razorpay/'+order['id']+'/verify',json=data,headers=headers()).json()['payment_status']=='paid'
    assert gateway.captures==1
    with sessions()() as db:
        assert db.get(Variant,'sku-bottle').stock==3
        assert db.scalar(select(func.count()).select_from(Payment))==1
        assert db.scalar(select(func.count()).select_from(OrderEvent).where(OrderEvent.status=='Order Confirmed'))==1


def test_signature_amount_ownership_and_fulfilment_guards(client,gateway):
    order,checkout=start(client,gateway);data=callback(gateway,checkout)
    path='/api/payments/razorpay/'+order['id']+'/verify'
    assert client.post(path,json={**data,'razorpay_signature':'0'*64},headers=headers()).status_code==400
    assert client.post(path,json=data,headers=headers('other')).status_code==404
    gateway.entities['pay_test1']['amount']=1
    assert client.post(path,json=data,headers=headers()).status_code==409
    assert client.patch('/api/admin/orders/'+order['id'],json={'status':'Packed'},headers=headers('owner')).status_code==409
    with sessions()() as db:assert db.scalar(select(Payment)).status=='pending'


def test_failed_payment_can_retry_same_gateway_order(client,gateway):
    order,checkout=start(client,gateway);failed=callback(gateway,checkout,'pay_fail','failed')
    path='/api/payments/razorpay/'+order['id']
    assert client.post(path+'/verify',json=failed,headers=headers()).json()['payment_status']=='failed'
    retry=client.post(path+'/checkout',headers=headers()).json()
    assert retry['razorpay_order_id']==checkout['razorpay_order_id'];assert gateway.creates==1
    success=callback(gateway,checkout,'pay_success','captured')
    assert client.post(path+'/verify',json=success,headers=headers()).json()['payment_status']=='paid'
    assert client.post(path+'/verify',json=failed,headers=headers()).json()['payment_status']=='paid'


def test_lost_creation_response_is_reconciled_not_duplicated(client,gateway):
    gateway.lose_response=True
    data=payload(client);data['payment']='RAZORPAY'
    order=client.post('/api/orders',json=data,headers=headers()).json()
    path='/api/payments/razorpay/'+order['id']+'/checkout'
    assert client.post(path,headers=headers()).status_code==503
    assert client.post(path,headers=headers()).status_code==200
    assert gateway.creates==1


def test_signed_webhooks_are_idempotent_and_cannot_downgrade_paid(client,gateway):
    order,checkout=start(client,gateway);data=callback(gateway,checkout,'pay_webhook','captured')
    body=json.dumps({'event':'payment.captured','payload':{'payment':{'entity':gateway.entities['pay_webhook']}}}).encode()
    signature=hmac.new(settings().razorpay_webhook_secret.encode(),body,hashlib.sha256).hexdigest()
    path='/api/payments/razorpay/webhook'
    assert client.post(path,content=body,headers={'x-razorpay-signature':'bad'}).status_code==400
    h={'x-razorpay-signature':signature,'x-razorpay-event-id':'evt_test_1'}
    assert client.post(path,content=body,headers=h).status_code==200
    assert client.post(path,content=body,headers=h).json()['duplicate'] is True
    with sessions()() as db:
        assert db.scalar(select(Payment)).status=='paid'
        assert db.scalar(select(func.count()).select_from(PaymentEvent))==1
    assert client.patch('/api/admin/orders/'+order['id'],json={'status':'Cancelled'},headers=headers('owner')).status_code==409


def test_live_key_is_rejected(monkeypatch):
    monkeypatch.setattr(settings(),'razorpay_key_id','rzp_live_forbidden')
    with pytest.raises(HTTPException) as error:payments.Gateway()
    assert error.value.status_code==503
