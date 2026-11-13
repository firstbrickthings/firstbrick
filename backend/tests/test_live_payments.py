"""Live-mode contracts use a fake gateway; no bank account or real charge is accessed."""
import hashlib,hmac,json
import pytest
from app import payments
from app.config import settings
from app.db import sessions
from app.models import Payment,Product,Variant
from conftest import headers
from test_store import payload
from test_payments import FakeGateway,start,callback

@pytest.fixture
def live(monkeypatch):
    cfg=settings()
    for key,value in {'razorpay_live_key_id':'rzp_live_fixture','razorpay_live_key_secret':'live-unit-secret','razorpay_live_webhook_secret':'live-unit-webhook','razorpay_mode':'live'}.items():monkeypatch.setattr(cfg,key,value)
    fake=FakeGateway();fake.key_id=cfg.razorpay_live_key_id;fake.secret=cfg.razorpay_live_key_secret
    monkeypatch.setattr(payments,'Gateway',lambda mode=None:fake)
    monkeypatch.setattr(payments,'_live_connection',{'fingerprint':payments.live_fingerprint(),'credentials_verified':True,'webhook_ready':True,'message':'Unit fixture'})
    payments.upi_availability.cache_clear()
    yield fake
    payments.upi_availability.cache_clear()


def test_live_keys_do_not_enable_payments_without_a_verified_setup(client,monkeypatch):
    for key,value in {'razorpay_mode':'live','razorpay_live_key_id':'rzp_live_fixture','razorpay_live_key_secret':'unit-secret'}.items():monkeypatch.setattr(settings(),key,value)
    assert client.get('/api/payments/config').json()['razorpay_live_enabled'] is False
    data=payload(client);data['payment']='RAZORPAY'
    assert client.post('/api/orders',json=data,headers=headers()).status_code==503
    with sessions()() as db:assert db.get(Variant,'sku-bottle').stock==5


def test_live_order_pins_mode_and_key_and_only_verified_capture_confirms(client,live):
    order,checkout=start(client,live)
    assert checkout['test_mode'] is False and checkout['payment_mode']=='live'
    assert checkout['checkout']['key']=='rzp_live_fixture' and 'TEST' not in checkout['checkout']['description']
    assert settings().razorpay_live_key_secret not in json.dumps(checkout)
    assert live.orders[checkout['razorpay_order_id']]['notes']['mode']=='live'
    with sessions()() as db:
        payment=db.get(Payment,1);assert payment.mode=='live' and payment.key_id=='rzp_live_fixture'
    data=callback(live,checkout)
    result=client.post('/api/payments/razorpay/'+order['id']+'/verify',json=data,headers=headers())
    assert result.json()['payment_status']=='paid' and result.json()['order']['payment_mode']=='live'
    assert live.captures==1


def test_live_config_uses_live_upi_capabilities(client,live):
    result=client.get('/api/payments/config').json()
    assert result['razorpay_enabled'] and result['razorpay_live_enabled'] and not result['razorpay_test_enabled']
    assert result['upi_enabled'] and not result['test_mode']
    assert not settings().test_checkout_enabled


def test_paid_history_keeps_its_mode_after_switch(client,live,monkeypatch):
    order,checkout=start(client,live);data=callback(live,checkout,status='captured')
    path='/api/payments/razorpay/'+order['id']
    client.post(path+'/verify',json=data,headers=headers()).raise_for_status()
    monkeypatch.setattr(settings(),'razorpay_mode','test')
    response=client.get(path+'/status',headers=headers()).json()
    assert response['payment_status']=='paid' and response['payment_mode']=='live'


def test_unpaid_order_cannot_change_mode_or_key(client,live,monkeypatch):
    order,checkout=start(client,live);path='/api/payments/razorpay/'+order['id']+'/checkout'
    monkeypatch.setattr(settings(),'razorpay_mode','test')
    assert client.post(path,headers=headers()).status_code==409
    monkeypatch.setattr(settings(),'razorpay_mode','live')
    live.key_id='rzp_live_different'
    assert client.post(path,headers=headers()).status_code==409
    assert live.creates==1


def test_test_product_cannot_be_bought_in_live_mode(client,live):
    from app.test_catalog import PRODUCT_ID,VARIANT_ID,CATEGORY_ID
    from app.models import Category
    with sessions()() as db:
        db.add(Category(id=CATEGORY_ID,name='Payment Testing',delivery_fee=0));db.flush()
        db.add(Product(id=PRODUCT_ID,name='Never charge this test item',category_id=CATEGORY_ID,active=True,sale_enabled=True,metadata_json={'payment_test':True}));db.flush()
        db.add(Variant(id=VARIANT_ID,product_id=PRODUCT_ID,price=10,stock=10));db.commit()
    result=client.post('/api/checkout/quote',json={'items':[{'variant_id':VARIANT_ID,'quantity':1}]},headers=headers())
    assert result.status_code==409
    assert client.get('/api/catalog/products/'+PRODUCT_ID).json()['sale_enabled'] is False


def test_webhook_mode_and_secret_cannot_cross_confirm_orders(client,live,monkeypatch):
    monkeypatch.setattr(settings(),'razorpay_webhook_secret','test-secret')
    order,checkout=start(client,live);callback(live,checkout,'pay_livehook','captured')
    body=json.dumps({'event':'payment.captured','payload':{'payment':{'entity':live.entities['pay_livehook']}}}).encode()
    test_sig=hmac.new(b'test-secret',body,hashlib.sha256).hexdigest()
    live_sig=hmac.new(settings().razorpay_live_webhook_secret.encode(),body,hashlib.sha256).hexdigest()
    base='/api/payments/razorpay/webhook'
    assert client.post(base+'/live',content=body,headers={'x-razorpay-signature':test_sig}).status_code==400
    result=client.post(base,content=body,headers={'x-razorpay-signature':test_sig})
    assert result.json()['matched'] is False
    assert client.get('/api/me/orders/'+order['id'],headers=headers()).json()['payment_status']=='pending'
    assert client.post(base+'/live',content=body,headers={'x-razorpay-signature':live_sig}).status_code==200
    assert client.get('/api/me/orders/'+order['id'],headers=headers()).json()['payment_status']=='paid'


def test_preparation_only_reads_orders_and_registers_own_callback(client,live,monkeypatch):
    monkeypatch.setattr(settings(),'razorpay_prepare_live',True)
    calls=[];original=live.call
    def provider(method,path,data=None):
        calls.append((method,path,data))
        if path=='/orders?count=1':return {'items':[]}
        if path.startswith('/webhooks?'):return {'items':[{'id':'unrelated','url':'https://example.org/other'}]}
        if method=='POST' and path=='/webhooks':return {**data,'id':'hook_fixture','secret_exists':True}
        return original(method,path,data)
    live.call=provider
    result=payments.prepare_live_connection()
    assert result['credentials_verified'] and result['webhook_ready']
    assert [p for method,p,_ in calls if method=='POST']==['/webhooks']
    assert all('/capture' not in p for _,p,_ in calls)
    webhook=calls[-1][2];assert webhook['url'].endswith('/webhook/live') and set(webhook['events'])==payments.LIVE_EVENTS


def test_preparation_failure_disables_live_charges_without_exposing_secrets(client,live,monkeypatch):
    def fail(*args,**kwargs):raise payments.GatewayError(uncertain=False,status=401)
    live.call=fail
    result=payments.prepare_live_connection()
    assert not result['credentials_verified'] and not payments.new_payments_enabled()
    assert settings().razorpay_live_key_secret not in json.dumps(result)


def test_old_quote_is_rejected_after_mode_switch(client,live,monkeypatch):
    monkeypatch.setattr(settings(),'razorpay_mode','test');data=payload(client);data['payment']='RAZORPAY'
    monkeypatch.setattr(settings(),'razorpay_mode','live')
    assert client.post('/api/orders',json=data,headers=headers()).status_code==409
    with sessions()() as db:assert db.get(Variant,'sku-bottle').stock==5


def test_webhook_api_denial_leaves_live_checkout_disabled(client,live,monkeypatch):
    monkeypatch.setattr(settings(),'razorpay_prepare_live',True)
    def provider(method,path,data=None):
        if path=='/orders?count=1':return {'items':[]}
        raise payments.GatewayError(uncertain=False,status=403)
    live.call=provider
    result=payments.prepare_live_connection()
    assert result['credentials_verified'] and not result['webhook_ready'] and not payments.new_payments_enabled()


def test_invalid_webhook_listing_does_not_create_a_duplicate(client,live,monkeypatch):
    monkeypatch.setattr(settings(),'razorpay_prepare_live',True);calls=[]
    def provider(method,path,data=None):calls.append(method);return {'invalid':'response'}
    live.call=provider
    result=payments.prepare_live_connection()
    assert result['credentials_verified'] and not result['webhook_ready'] and calls==['GET','GET']
