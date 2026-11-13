import gzip,json
from uuid import uuid4
from sqlalchemy import select,func
from app import payments
from app.catalog_setup import apply_requested_setup
from app.config import settings
from app.db import sessions
from app.models import Product,Variant,Category,StoreSnapshot,Order,Payment,ReportingEvent,WhatsAppMessage
from conftest import headers
from test_live_payments import live
from test_payments import callback


def test_requested_stock_five_is_private_backed_up_and_runs_once(client,monkeypatch):
    with sessions()() as db:
        p=db.get(Product,'bottle');p.sale_enabled=False;db.get(Variant,'sku-bottle').stock=2
        db.add(Product(id='archive',name='Archived',category_id='feeding',active=False));db.add(Product(id='test-only',name='Test only',category_id='feeding',active=True,metadata_json={'payment_test':True}));db.flush()
        db.add_all([Variant(id='archive-v',product_id='archive',price=100,stock=7),Variant(id='test-v',product_id='test-only',price=10,stock=8),Variant(id='disabled-v',product_id='bottle',price=100,stock=99,enabled=False)]);db.commit()
        monkeypatch.setattr(settings(),'catalog_stock_five_once',True);monkeypatch.setattr(settings(),'catalog_publish_prices_once',False)
        apply_requested_setup(db)
        assert db.get(Variant,'sku-bottle').stock==5 and not db.get(Product,'bottle').sale_enabled
        assert db.get(Variant,'archive-v').stock==7 and db.get(Variant,'test-v').stock==8 and db.get(Variant,'disabled-v').stock==99
        backup=json.loads(gzip.decompress(db.get(StoreSnapshot,'stock-five-visible-20261113').payload));assert next(v for v in backup['variants'] if v['id']=='sku-bottle')['stock']==2
        db.get(Variant,'sku-bottle').stock=3;db.commit();apply_requested_setup(db);assert db.get(Variant,'sku-bottle').stock==3


def test_price_publication_requires_its_own_explicit_setup_flag(client,monkeypatch):
    with sessions()() as db:
        db.get(Product,'bottle').sale_enabled=False;db.commit()
        monkeypatch.setattr(settings(),'catalog_stock_five_once',True);monkeypatch.setattr(settings(),'catalog_publish_prices_once',False);apply_requested_setup(db);assert not db.get(Product,'bottle').sale_enabled
        monkeypatch.setattr(settings(),'catalog_publish_prices_once',True);apply_requested_setup(db);assert db.get(Product,'bottle').sale_enabled
        assert db.get(StoreSnapshot,'publish-reviewed-prices-20261113')


def test_live_check_is_owner_only_fixed_amount_and_reuses_pending_check(client,live):
    body={'request_id':str(uuid4())}
    assert client.post('/api/admin/payments/check',json=body).status_code==401
    assert client.post('/api/admin/payments/check',json=body,headers=headers()).status_code==403
    assert client.post('/api/admin/payments/check',json={**body,'amount':'5000'},headers=headers('owner')).status_code==422
    first=client.post('/api/admin/payments/check',json=body,headers=headers('owner'));assert first.status_code==200,first.text
    first=first.json();assert first['total']=='10.00' and first['kind']=='gateway_check' and first['allowed_next_statuses']==[]
    for request in [body,{'request_id':str(uuid4())}]:assert client.post('/api/admin/payments/check',json=request,headers=headers('owner')).json()['id']==first['id']
    assert client.get('/api/admin/payments/check/latest',headers=headers('owner')).json()['order']['id']==first['id']
    with sessions()() as db:
        assert db.scalar(select(func.count()).select_from(Order))==1 and db.scalar(select(Payment)).amount_paise==1000
        assert db.get(Variant,'sku-bottle').stock==5


def test_live_check_verification_never_becomes_a_purchase_or_notification(client,live):
    body={'request_id':str(uuid4())};order=client.post('/api/admin/payments/check',json=body,headers=headers('owner')).json();base='/api/payments/razorpay/'+order['id']
    checkout=client.post(base+'/checkout',headers=headers('owner')).json();assert checkout['checkout']['amount']==1000
    assert 'check' in checkout['checkout']['description']
    data=callback(live,checkout,'pay_check1','captured')
    result=client.post(base+'/verify',json=data,headers=headers('owner'));assert result.status_code==200,result.text
    assert result.json()['payment_status']=='paid' and result.json()['order']['status']=='Payment Verified'
    assert client.get('/api/me/orders',headers=headers('owner')).json()['total']==0
    assert client.get('/api/admin/orders',headers=headers('owner')).json()['total']==0
    assert client.patch('/api/admin/orders/'+order['id'],json={'status':'Packed'},headers=headers('owner')).status_code==409
    with sessions()() as db:
        assert db.scalar(select(func.count()).select_from(ReportingEvent))==0 and db.scalar(select(func.count()).select_from(WhatsAppMessage))==0
        assert db.get(Variant,'sku-bottle').stock==5
    assert client.post('/api/admin/payments/check',json={'request_id':str(uuid4())},headers=headers('owner')).json()['id']!=order['id']


def test_requested_ten_rupees_and_five_stock_publish_once_without_touching_archives(client,monkeypatch):
    with sessions()() as db:
        p=db.get(Product,'bottle');p.sale_enabled=False;db.get(Variant,'sku-bottle').stock=0
        db.add(Product(id='archive',name='Archived',category_id='feeding',active=False));db.flush();db.add(Variant(id='archive-v',product_id='archive',price=777,stock=8));db.commit()
        for key in ['catalog_stock_five_once','catalog_price_ten_once','catalog_publish_prices_once']:monkeypatch.setattr(settings(),key,True)
        apply_requested_setup(db);v=db.get(Variant,'sku-bottle')
        assert v.price==10 and v.stock==5 and db.get(Product,'bottle').sale_enabled
        assert db.get(Variant,'archive-v').price==777 and db.get(Variant,'archive-v').stock==8
        original=json.loads(gzip.decompress(db.get(StoreSnapshot,'stock-five-visible-20261113').payload));assert original['variants'][0]['price']=='499.00'
        v.price=125;v.stock=3;db.commit();apply_requested_setup(db);assert v.price==125 and v.stock==3
