import gzip
import json
from datetime import timedelta
from uuid import uuid4
from sqlalchemy import func, select
from app.config import settings
from app.db import sessions
from app.models import Customer, Order, Product, ReportingEvent, StoreDocument, VisitSession, now
from app import reporting
from conftest import headers
from test_store import payload, SHIPPING


def test_owner_publishing_and_conflict_is_shared(client):
    body={'expected_version':0,'value':{'items':[{'id':'home-1','image':'assets/favicon.svg','published':True},{'id':'home-2','image':'https://example.com/private.jpg','published':False}]}}
    assert client.put('/api/admin/content/hero',json=body,headers=headers()).status_code==403
    first=client.put('/api/admin/content/hero',json=body,headers=headers('owner'))
    assert first.status_code==200,first.text
    assert first.json()['version']==1
    assert len(client.get('/api/store/content').json()['hero']['value']['items'])==1
    assert len(client.get('/api/admin/content/hero',headers=headers('owner')).json()['value']['items'])==2
    assert client.put('/api/admin/content/hero',json=body,headers=headers('owner')).status_code==409
    body['expected_version']=1;body['value']['items']=[]
    assert client.put('/api/admin/content/hero',json=body,headers=headers('owner')).status_code==200
    assert client.get('/api/store/content').json()['hero']['value']['items']==[]


def test_content_rejects_unsafe_urls_and_fields(client):
    for item in [{'id':'x','image':'javascript:alert(1)'},{'id':'x','image':'data:text/html,hello'},{'id':'x','image':'assets/../secret'},{'id':'x','image':'https://example.com/a','phone':'private'}]:
        r=client.put('/api/admin/content/hero',json={'expected_version':0,'value':{'items':[item]}},headers=headers('owner'))
        assert r.status_code==422,r.text


def test_categories_publish_atomically_and_preserve_fees(client):
    data={'expected_version':0,'value':{'items':[{'id':'feeding','name':'Feeding updated','img':'assets/favicon.svg','subcategories':['Bottles'], 'published':True}]}}
    assert client.put('/api/admin/content/categories',json=data,headers=headers('owner')).status_code==200
    category=client.get('/api/catalog/categories').json()[0]
    assert category['name']=='Feeding updated' and category['delivery_fee']=='60.00'
    data['expected_version']=1;data['value']['items'].append({'id':'other','name':'Feeding updated','img':'','subcategories':[]})
    assert client.put('/api/admin/content/categories',json=data,headers=headers('owner')).status_code==409
    assert client.get('/api/admin/content/categories',headers=headers('owner')).json()['version']==1


def test_real_reviews_publish_hide_delete_and_owner_only(client):
    assert client.get('/api/store/reviews').json()==[]
    body={'name':'Test Parent','message':'A real review supplied by its author.','rating':5,'published':False,'position':2}
    assert client.post('/api/admin/reviews',json=body,headers=headers()).status_code==403
    r=client.post('/api/admin/reviews',json=body,headers=headers('owner'));assert r.status_code==201
    rid=r.json()['id'];assert client.get('/api/store/reviews').json()==[]
    assert client.put('/api/admin/reviews/'+rid,json={**body,'published':True,'position':0},headers=headers('owner')).status_code==200
    assert client.get('/api/store/reviews').json()[0]['id']==rid
    assert client.put('/api/admin/reviews/'+rid,json={**body,'rating':6},headers=headers('owner')).status_code==422
    assert client.delete('/api/admin/reviews/'+rid,headers=headers('owner')).status_code==204
    assert client.get('/api/store/reviews').json()==[]


def test_registration_and_measured_analytics_do_not_fake_history(client):
    with sessions()() as db:
        db.add(Customer(uid='historical',phone='+919000000001',details={'name':'Existing Parent'}));db.commit()
    assert client.post('/api/me/register',headers=headers()).status_code==200
    assert client.post('/api/me/register',headers=headers()).status_code==200
    sid=str(uuid4())
    assert client.post('/api/store/visit',json={'id':sid,'source':'google'},headers={}).status_code==204
    assert client.post('/api/store/visit',json={'id':sid,'source':'other'},headers={}).status_code==204
    assert client.get('/api/admin/overview?days=7',headers=headers()).status_code==403
    r=client.get('/api/admin/overview?days=1',headers=headers('owner')).json()
    assert r['total_customers']==2 and r['new_signups_today']==1
    assert r['total_traffic']==1 and r['active_users']==1 and len(r['traffic'])==24
    assert sum(p['value'] for p in r['growth'])==1
    assert r['sources']==[{'name':'google','visits':1}]
    assert client.get('/api/admin/overview?days=2',headers=headers('owner')).status_code==422
    assert client.post('/api/store/visit',json={'id':sid,'source':'x','phone':'private'}).status_code==422


def test_delivery_uses_destination_weight_volume_and_quantity(client):
    items=[{'variant_id':'sku-bottle','quantity':2}]
    preview=client.post('/api/checkout/quote',json={'items':items},headers=headers()).json()
    assert preview['delivery_pending'] and preview['deliveryBreakdown']==[]
    r=client.post('/api/checkout/quote',json={'items':items,'pin':'682001'},headers=headers()).json()
    assert r['delivery']=='60.00'
    assert r['deliveryBreakdown'][0]['parcels']==2
    assert client.post('/api/checkout/quote',json={'items':items,'pin':'110001'},headers=headers()).status_code==409
    with sessions()() as db:
        p=db.get(Product,'bottle');p.metadata_json={'shipping':{'weight_kg':'0.5','length_cm':'50','width_cm':'30','height_cm':'20','bulky':True}};db.commit()
    # 50*30*20/5000 = 6kg, above the 1kg first band, +5 extra kg per parcel.
    r=client.post('/api/checkout/quote',json={'items':items,'pin':'682001'},headers=headers()).json()
    assert r['delivery']=='160.00'
    assert r['deliveryBreakdown'][0]['billed_kg']=='6'


def test_unconfirmed_and_unmeasured_shipping_does_not_charge_a_guess(client):
    data=payload(client)
    with sessions()() as db:
        p=db.get(Product,'bottle');p.metadata_json={};db.commit()
    r=client.post('/api/orders',json=data,headers=headers());assert r.status_code==409
    assert 'measurements' in r.json()['detail']
    with sessions()() as db:
        assert db.scalar(select(func.count()).select_from(Order))==0


def test_order_status_updates_customer_tracking_and_outbox(client):
    order=client.post('/api/orders',json=payload(client),headers=headers()).json()
    assert client.get('/api/admin/orders/'+order['id'],headers=headers('owner')).status_code==200
    for status in ['Packed','Shipped','Out for Delivery','Delivered']:
        updated=client.patch('/api/admin/orders/'+order['id'],json={'status':status},headers=headers('owner'))
        assert updated.status_code==200,updated.text
        assert client.get('/api/me/orders/'+order['id'],headers=headers()).json()['status']==status
    assert client.get('/api/me/orders/'+order['id'],headers=headers('other')).status_code==404
    assert client.get('/api/me/orders/'+order['id'],headers=headers()).json()['allowed_next_statuses']==[]
    with sessions()() as db:
        assert db.scalar(select(func.count()).select_from(ReportingEvent).where(ReportingEvent.kind!='owner_order_email'))==5
        assert db.get(Order,order['id']).total==1058


def test_private_backup_round_trip_contains_records(client):
    order=client.post('/api/orders',json=payload(client),headers=headers()).json()
    assert client.get('/api/admin/backup',headers=headers()).status_code==403
    r=client.get('/api/admin/backup',headers=headers('owner'));assert r.status_code==200
    data=json.loads(gzip.decompress(r.content))
    assert data['tables']['orders'][0]['id']==order['id']
    assert 'store_snapshots' not in data['tables']


def test_sheet_failure_retries_and_requires_exact_ack(client,monkeypatch):
    client.post('/api/orders',json=payload(client),headers=headers())
    monkeypatch.setattr(settings(),'sheets_enabled',True);monkeypatch.setattr(settings(),'sheets_secret','fake-private-unit-test-secret');monkeypatch.setattr(settings(),'sheets_url','https://script.google.com/macros/s/test/exec')
    class Reply:
        def __init__(self,result):self.result=result
        def __enter__(self):return self
        def __exit__(self,*args):pass
        def read(self,*args):return json.dumps(self.result).encode()
    monkeypatch.setattr(reporting,'urlopen',lambda *a,**k:Reply({'ok':True,'event_id':'wrong'}))
    with sessions()() as db:
        db.scalar(select(ReportingEvent).where(ReportingEvent.kind!='owner_order_email')).next_attempt=now()-timedelta(seconds=1);db.commit()
    reporting.drain()
    with sessions()() as db:
        row=db.scalar(select(ReportingEvent).where(ReportingEvent.kind!='owner_order_email'));assert row.status=='pending' and row.attempts==1
        row.next_attempt=now()-timedelta(seconds=1);eid=row.id;db.commit()
    monkeypatch.setattr(reporting,'urlopen',lambda *a,**k:Reply({'ok':True,'event_id':eid}))
    reporting.drain()
    with sessions()() as db:
        row=db.get(ReportingEvent,eid);assert row.status=='sent' and row.attempts==2


def test_media_requires_verified_owner_and_valid_content(client):
    content=b'<html>not an image</html>'
    assert client.post('/api/admin/media',files={'file':('x.jpg',content,'image/jpeg')}).status_code==401
    assert client.post('/api/admin/media',files={'file':('x.jpg',content,'image/jpeg')},headers=headers()).status_code==403
    assert client.post('/api/admin/media',files={'file':('x.jpg',content,'image/jpeg')},headers=headers('owner')).status_code==422


def test_approved_carton_combines_compact_products_without_guessing(client):
    with sessions()() as db:
        row=db.get(StoreDocument,'shipping')
        row.value={**row.value,'cartons':[{'id':'compact','name':'Approved compact box','weight_kg':'0.1','length_cm':'20','width_cm':'10','height_cm':'10','product_ids':['bottle'],'max_units':2,'max_weight_kg':'2','fit_confirmed':True}]}
        db.commit()
    result=client.post('/api/checkout/quote',json={'items':[{'variant_id':'sku-bottle','quantity':2}],'pin':'682001'},headers=headers()).json()
    # One approved box: 2*0.5kg +0.1kg packing =1.1kg -> first band + one extra kg =40.
    assert result['delivery']=='40.00'
    assert result['deliveryBreakdown'][0]['parcels']==1
    assert float(result['deliveryBreakdown'][0]['actual_kg'])==1.1


def test_reviewed_device_order_becomes_shared_without_fake_payment_or_stock(client):
    data={'id':'BO-HISTORICAL-01','dateISO':'2026-01-01T10:00:00+05:30','name':'Historical Parent','phone':'9999999999',
          'items':[{'id':'old-sku','name':'Original item','price':'100','qty':1}],
          'subtotal':'100','delivery':'99','total':'199','status':'Order Confirmed','confirmed':True}
    assert client.post('/api/admin/import/legacy-order',json=data,headers=headers()).status_code==403
    first=client.post('/api/admin/import/legacy-order',json=data,headers=headers('owner'))
    assert first.status_code==200,first.text
    assert first.json()['payment_status']=='historical_unverified'
    assert client.post('/api/admin/import/legacy-order',json=data,headers=headers('owner')).status_code==200
    assert client.post('/api/admin/import/legacy-order',json={**data,'name':'Do not overwrite'},headers=headers('owner')).status_code==409
    assert client.get('/api/me/orders',headers=headers()).json()['items'][0]['id']==data['id']
    assert client.get('/api/me/orders/'+data['id'],headers=headers('other')).status_code==404
    assert client.patch('/api/admin/orders/'+data['id'],json={'status':'Packed'},headers=headers('owner')).status_code==200
    assert client.get('/api/me/orders/'+data['id'],headers=headers()).json()['status']=='Packed'
    assert not any(k.startswith('legacy-order:') for k in client.get('/api/store/content').json())


def test_media_upload_stream_is_shared_and_redirects_to_storage(client,monkeypatch):
    from app import workspace
    from app.models import MediaFile
    class Storage:
        received=None
        def upload_fileobj(self,file,bucket,key,ExtraArgs):
            self.received=file.read()
            assert ExtraArgs['ContentType']=='image/png'
        def generate_presigned_url(self,*args,**kwargs):
            return 'https://example.com/signed-test-image'
    fake=Storage();monkeypatch.setattr(workspace,'storage',lambda:fake)
    png=b'\x89PNG\r\n\x1a\n'+b'\0'*40
    r=client.post('/api/admin/media',files={'file':('image.png',png,'image/png')},headers=headers('owner'))
    assert r.status_code==201,r.text
    assert fake.received==png
    result=r.json()
    with sessions()() as db:assert db.get(MediaFile,result['id']).size==len(png)
    response=client.get(result['url'],follow_redirects=False)
    assert response.status_code==307 and response.headers['location']=='https://example.com/signed-test-image'
