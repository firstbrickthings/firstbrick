import hashlib
import hmac
import json
from datetime import timedelta
from urllib.error import HTTPError
from urllib.parse import parse_qs,urlsplit
import pytest
from sqlalchemy import func,select
from app import messaging
from app.config import settings
from app.db import sessions
from app.models import CustomerCart,Order,Product,Variant,WhatsAppMessage,WhatsAppPreference,now
from conftest import headers
from test_store import payload

ITEMS=[{'variant_id':'sku-bottle','quantity':2}]

def cart(client,items=None,version=0,user='customer'):
    return client.put('/api/me/cart',json={'items':ITEMS if items is None else items,'expected_version':version},headers=headers(user))

def preference(client,cart_reminders=True,order_updates=True):
    return client.put('/api/me/whatsapp',json={'cart_reminders':cart_reminders,'order_updates':order_updates},headers=headers())

@pytest.fixture
def sending(monkeypatch):
    cfg=settings()
    for key,value in {'whatsapp_enabled':True,'whatsapp_access_token':'fake-unit-token','whatsapp_phone_number_id':'123456','whatsapp_app_secret':'unit-app-secret','whatsapp_verify_token':'unit-verify','whatsapp_graph_version':'v26.0','cart_link_secret':'unit-cart-link-secret-at-least-32-characters'}.items():monkeypatch.setattr(cfg,key,value)
    monkeypatch.setattr(messaging,'check_connection',lambda **kwargs:{'ready':True,'message':'Unit fixture'})
    sent=[]
    monkeypatch.setattr(messaging,'provider_call',lambda body:(sent.append(body) or {'messages':[{'id':'wamid.test-'+str(len(sent))}]}))
    return sent


def age_reminders():
    with sessions()() as db:
        for c in db.scalars(select(CustomerCart)):c.updated_at=now()-timedelta(minutes=21)
        for m in db.scalars(select(WhatsAppMessage).where(WhatsAppMessage.kind=='cart_reminder')):m.due_at=now()-timedelta(seconds=2)
        db.commit()


def callback(client,value,signature=True):
    raw=json.dumps({'object':'whatsapp_business_account','entry':[{'changes':[{'value':{'metadata':{'phone_number_id':'123456'},**value}}]}]}).encode()
    digest='sha256='+hmac.new(settings().whatsapp_app_secret.encode(),raw,hashlib.sha256).hexdigest()
    return client.post('/api/webhooks/whatsapp',content=raw,headers={'Content-Type':'application/json','x-hub-signature-256':digest if signature else 'wrong'})


def test_saved_cart_ownership_prices_and_stock(client):
    assert client.get('/api/me/cart').status_code==401
    assert client.get('/api/me/cart',headers=headers()).json()['version']==0
    saved=cart(client);assert saved.status_code==200,saved.text
    assert saved.json()['subtotal']=='998.00' and saved.json()['items'][0]['size']=='250 ml'
    assert client.get('/api/me/cart',headers=headers('other')).json()['items']==[]
    assert client.get('/api/admin/customer?uid=customer-uid',headers=headers()).status_code==403
    profile=client.get('/api/admin/customer?uid=customer-uid',headers=headers('owner')).json()
    assert profile['cart']['items'][0]['quantity']==2
    assert client.get('/api/admin/customers',headers=headers('owner')).json()['items'][0]['cart_items']==2
    with sessions()() as db:assert db.get(Variant,'sku-bottle').stock==5
    bad={'items':ITEMS,'expected_version':1,'customer_uid':'other-uid'}
    assert client.put('/api/me/cart',json=bad,headers=headers()).status_code==422


def test_cart_changes_use_versions_and_preserve_other_device(client):
    initial=cart(client).json()
    assert cart(client,[{'variant_id':'sku-bottle','quantity':3}],version=0).status_code==409
    unchanged=cart(client,version=initial['version']).json();assert unchanged['version']==initial['version']
    changed=cart(client,[],version=initial['version']).json();assert changed['version']==2 and changed['items']==[]
    assert cart(client,[{'variant_id':'sku-bottle','quantity':101}],version=2).status_code==422
    assert cart(client,[{'variant_id':'sku-bottle','quantity':60},{'variant_id':'sku-bottle','quantity':60}],version=2).status_code==422


def test_cart_price_and_availability_are_not_client_claims(client):
    cart(client)
    with sessions()() as db:
        variant=db.get(Variant,'sku-bottle');variant.price=600;variant.stock=1;db.commit()
    row=client.get('/api/me/cart',headers=headers()).json()['items'][0]
    assert row['price']=='600.00' and row['available'] is False
    bad=client.put('/api/me/cart',json={'items':[{'variant_id':'sku-bottle','quantity':1,'price':'0.01'}],'expected_version':1},headers=headers())
    assert bad.status_code==422


def test_opt_in_is_explicit_and_cannot_choose_a_third_party_phone(client):
    assert client.get('/api/me/whatsapp',headers=headers()).json()['cart_reminders'] is False
    assert client.put('/api/me/whatsapp',json={'cart_reminders':True,'order_updates':True,'phone':'+918888888888'},headers=headers()).status_code==422
    assert preference(client).json()['phone']=='+919999999999'
    cart(client)
    with sessions()() as db:
        row=db.scalar(select(WhatsAppMessage));assert row.kind=='cart_reminder' and row.status=='pending'
        assert timedelta(minutes=19)<row.due_at-now()<timedelta(minutes=21)
    preference(client,False,False)
    with sessions()() as db:assert db.scalar(select(WhatsAppMessage)).status=='cancelled'


def test_reminder_waits_20_minutes_and_sends_once(sending,client):
    preference(client);cart(client);messaging.drain();assert sending==[]
    age_reminders();messaging.drain();messaging.drain();assert len(sending)==1
    body=sending[0];assert body['to']=='919999999999' and body['type']=='template'
    assert body['template']['name']=='babyone_cart_reminder'
    with sessions()() as db:
        row=db.scalar(select(WhatsAppMessage));assert row.status=='accepted' and row.attempts==1


def test_cart_change_cancels_old_reminder_and_resets_clock(sending,client):
    preference(client);cart(client);age_reminders()
    cart(client,[{'variant_id':'sku-bottle','quantity':3}],1)
    messaging.drain();assert sending==[]
    with sessions()() as db:
        rows=db.scalars(select(WhatsAppMessage).order_by(WhatsAppMessage.cart_version)).all()
        assert [r.status for r in rows]==['cancelled','pending']
    age_reminders();messaging.drain();assert len(sending)==1


def test_order_cancels_cart_and_notifies_only_saved_statuses(sending,client):
    preference(client);cart(client);age_reminders();data=payload(client)
    order=client.post('/api/orders',json=data,headers=headers()).json()
    again=client.post('/api/orders',json=data,headers=headers()).json();assert again['id']==order['id']
    with sessions()() as db:
        assert db.scalar(select(WhatsAppMessage).where(WhatsAppMessage.kind=='cart_reminder')).status=='cancelled'
    messaging.drain();assert len(sending)==1
    for _ in range(2):assert client.patch('/api/admin/orders/'+order['id'],json={'status':'Packed'},headers=headers('owner')).status_code==200
    messaging.drain();assert len(sending)==2
    assert sending[-1]['template']['components'][0]['parameters'][2]['text']=='Packed'
    with sessions()() as db:assert db.scalar(select(func.count()).select_from(WhatsAppMessage).where(WhatsAppMessage.kind=='order_update'))==2


def test_old_status_is_not_sent_after_new_status_was_saved(sending,client):
    preference(client);order=client.post('/api/orders',json=payload(client),headers=headers()).json()
    client.patch('/api/admin/orders/'+order['id'],json={'status':'Packed'},headers=headers('owner'))
    messaging.drain();assert len(sending)==1
    assert sending[0]['template']['components'][0]['parameters'][2]['text']=='Packed'


def test_disabled_provider_never_sends(client,monkeypatch):
    preference(client);cart(client);age_reminders();monkeypatch.setattr(settings(),'whatsapp_enabled',False)
    monkeypatch.setattr(messaging,'provider_call',lambda body:pytest.fail('Disabled sender was called'))
    messaging.drain()
    assert client.get('/api/admin/whatsapp',headers=headers('owner')).json()['enabled'] is False
    assert client.get('/api/admin/whatsapp',headers=headers()).status_code==403


def test_uncertain_send_does_not_blindly_duplicate(sending,client,monkeypatch):
    preference(client);cart(client);age_reminders();calls=[]
    def lose(body):calls.append(body);raise TimeoutError('lost response')
    monkeypatch.setattr(messaging,'provider_call',lose)
    messaging.drain();messaging.drain();assert len(calls)==1
    with sessions()() as db:assert db.scalar(select(WhatsAppMessage)).status=='uncertain'


def test_known_rate_limit_is_retried(sending,client,monkeypatch):
    preference(client);cart(client);age_reminders()
    monkeypatch.setattr(messaging,'provider_call',lambda body:(_ for _ in ()).throw(HTTPError('https://example.com',429,'rate limit',{},None)))
    messaging.drain()
    with sessions()() as db:
        row=db.scalar(select(WhatsAppMessage));assert row.status=='pending' and row.attempts==1
        assert row.due_at>now()


def test_recovery_link_is_expiring_and_bound_to_verified_customer(sending,client):
    preference(client);cart(client);age_reminders();messaging.drain()
    with sessions()() as db:row=db.scalar(select(WhatsAppMessage));link=messaging.recovery_link(row);identifier=row.id
    q=parse_qs(urlsplit(link).query);path='/api/me/cart/recover?message_id='+identifier+'&expires='+q['expires'][0]+'&signature='+q['signature'][0]
    assert client.get(path).status_code==401
    assert client.get(path,headers=headers('other')).status_code==404
    response=client.get(path,headers=headers());assert response.status_code==200,response.text
    assert response.json()['items'][0]['quantity']==2
    assert client.get(path.replace(q['signature'][0],'0'*64),headers=headers()).status_code==410


def test_signed_delivery_receipts_are_monotonic_and_stop_disables_messages(sending,client):
    preference(client);cart(client);age_reminders();messaging.drain()
    assert callback(client,{'statuses':[{'id':'wamid.test-1','status':'delivered'}]},False).status_code==403
    for status in ['delivered','sent','read','failed']:
        assert callback(client,{'statuses':[{'id':'wamid.test-1','status':status}]}).status_code==200
    with sessions()() as db:assert db.scalar(select(WhatsAppMessage)).status=='read'
    assert callback(client,{'messages':[{'from':'919999999999','type':'text','text':{'body':'STOP'}}]}).status_code==200
    result=client.get('/api/me/whatsapp',headers=headers()).json();assert not result['cart_reminders'] and not result['order_updates']
    assert client.get('/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=unit-verify&hub.challenge=test').text=='test'
    assert client.get('/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=test').status_code==403


def test_product_metadata_filters_and_bulk_edits_are_atomic(client):
    p=client.get('/api/admin/products',headers=headers('owner')).json()['items'][0]
    body={k:p[k] for k in ['name','description','category_id','image','active','sale_enabled','variants']}
    body.update(brand='BrandSearch',sku='TEST-SKU',subcategory='Bottles',badge='BabyOne',gallery_images=['assets/favicon.svg'],expected_version=p['version'])
    saved=client.put('/api/admin/products/bottle',json=body,headers=headers('owner'));assert saved.status_code==200,saved.text
    p=saved.json();assert p['metadata']['galleryImages']==['assets/favicon.svg']
    assert client.get('/api/admin/products?q=BrandSearch&subcategory=Bottles&stock=low',headers=headers('owner')).json()['total']==1
    data={'products':[{'id':p['id'],'version':p['version']}],'action':'add_stock','quantity':2}
    assert client.post('/api/admin/products/bulk',json=data,headers=headers()).status_code==403
    assert client.post('/api/admin/products/bulk',json=data,headers=headers('owner')).status_code==200
    assert client.post('/api/admin/products/bulk',json=data,headers=headers('owner')).status_code==409
    p=client.get('/api/admin/products',headers=headers('owner')).json()['items'][0]
    bad={**data,'products':[{'id':p['id'],'version':p['version']}],'action':'subtract_stock','quantity':100}
    assert client.post('/api/admin/products/bulk',json=bad,headers=headers('owner')).status_code==409
    with sessions()() as db:assert db.get(Variant,'sku-bottle').stock==7 and db.get(Product,'bottle').version==p['version']


def test_delivery_preview_is_owner_only_and_drafts_do_not_enable_checkout(client):
    data={'pin':'682001','parcel':{'weight_kg':'1','length_cm':'10','width_cm':'10','height_cm':'10'},'parcels':2,'payment':'RAZORPAY'}
    assert client.post('/api/admin/delivery/preview',json=data,headers=headers()).status_code==403
    from app.models import StoreDocument
    with sessions()() as db:
        doc=db.get(StoreDocument,'shipping');doc.value={**doc.value,'confirmed':False,'packing_per_parcel':'5','tax_percent':'10'};db.commit()
    result=client.post('/api/admin/delivery/preview',json=data,headers=headers('owner'))
    assert result.status_code==200,result.text
    assert result.json()['delivery']=='77.00' and result.json()['rates_confirmed'] is False
    quote=client.post('/api/checkout/quote',json={'items':ITEMS,'pin':'682001','payment':'RAZORPAY'},headers=headers())
    assert quote.status_code==409
    data['parcel']['height_cm']='0'
    assert client.post('/api/admin/delivery/preview',json=data,headers=headers('owner')).status_code==422


def test_same_products_after_order_start_a_new_cart_activity(client):
    preference(client);saved=cart(client).json()
    client.post('/api/orders',json=payload(client),headers=headers()).raise_for_status()
    result=cart(client,version=saved['version']).json()
    assert not result['ordered'] and result['version']==saved['version']+1
    with sessions()() as db:
        messages=list(db.scalars(select(WhatsAppMessage).where(WhatsAppMessage.kind=='cart_reminder').order_by(WhatsAppMessage.cart_version)))
        assert [m.status for m in messages]==['cancelled','pending']


def test_processing_send_is_not_repeated_after_a_worker_restart(sending,client):
    preference(client);cart(client);age_reminders()
    with sessions()() as db:
        message=db.scalar(select(WhatsAppMessage));message.status='processing';message.attempts=1;db.commit()
    messaging.drain();assert sending==[]


def test_cloud_connection_verifies_the_store_number(monkeypatch,client):
    import io
    cfg=settings()
    for key,value in {'whatsapp_access_token':'unit-token','whatsapp_phone_number_id':'123456','whatsapp_app_secret':'unit-secret','whatsapp_verify_token':'unit-verify','whatsapp_graph_version':'v26.0','cart_link_secret':'a'*40}.items():monkeypatch.setattr(cfg,key,value)
    monkeypatch.setattr(messaging,'_connection',{'key':'','checked_at':0,'ready':False,'message':''})
    monkeypatch.setattr(messaging,'urlopen',lambda *args,**kwargs:io.BytesIO(json.dumps({'display_phone_number':'+91 99999 99999'}).encode()))
    assert messaging.check_connection(force=True)['ready'] is False
    monkeypatch.setattr(messaging,'urlopen',lambda *args,**kwargs:io.BytesIO(json.dumps({'display_phone_number':'+91 70344 76592'}).encode()))
    assert messaging.check_connection(force=True)['ready'] is True
