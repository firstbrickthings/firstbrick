"""Owner-priced flat delivery is independent of parcel measurements and charged once."""
import gzip
import json
from uuid import uuid4
from app.config import settings
from app.db import sessions
from app.models import Product, Variant, StoreDocument, StoreSnapshot
from app.shipping_setup import apply_flat_delivery
from app.shipping import ShippingConfig
from conftest import headers
from test_live_payments import live
from test_payments import callback
from test_store import SHIPPING


def save_flat(client, amount='99.00', confirmed=True):
    original=client.get('/api/admin/content/shipping',headers=headers('owner')).json()
    value={**original['value'],'pricing_mode':'flat','flat_rate':amount,'confirmed':confirmed}
    response=client.put('/api/admin/content/shipping',json={'expected_version':original['version'],'value':value},headers=headers('owner'))
    assert response.status_code==200,response.text
    return response.json()


def test_flat_delivery_charged_once_for_mixed_unmeasured_bag(client):
    save_flat(client)
    with sessions()() as db:
        db.get(Product,'bottle').metadata_json={}
        db.get(Variant,'sku-bottle').price=10
        db.add(Product(id='tub',name='Large bath tub',category_id='feeding',sale_enabled=True,metadata_json={}))
        db.flush();db.add(Variant(id='tub-v',product_id='tub',price=10,stock=5));db.commit()
    items=[{'variant_id':'sku-bottle','quantity':2},{'variant_id':'tub-v','quantity':3}]
    for pin in ['673661','682001','110001']:
        r=client.post('/api/checkout/quote',json={'items':items,'pin':pin},headers=headers())
        assert r.status_code==200,r.text
        quote=r.json();assert quote['subtotal']=='50.00' and quote['delivery']=='99.00' and quote['total']=='149.00'
        assert not quote['delivery_pending'] and len(quote['deliveryBreakdown'])==1
        assert quote['deliveryBreakdown'][0]['mode']=='flat'
    assert client.post('/api/checkout/quote',json={'items':items,'pin':'bad'},headers=headers()).status_code==422
    assert client.post('/api/checkout/quote',json={'items':items,'pin':'673661','delivery':'0'},headers=headers()).status_code==422


def test_flat_changes_are_owner_only_versioned_and_invalidate_old_quote(client,live):
    doc=save_flat(client)
    items=[{'variant_id':'sku-bottle','quantity':1}]
    data={'items':items,'pin':SHIPPING['pin'],'payment':'RAZORPAY'}
    old=client.post('/api/checkout/quote',json=data,headers=headers()).json()
    forbidden=client.put('/api/admin/content/shipping',json={'expected_version':doc['version'],'value':doc['value']},headers=headers())
    assert forbidden.status_code==403
    save_flat(client,'125.00')
    request={'items':items,'shipping':SHIPPING,'payment':'RAZORPAY','quote_hash':old['quote_hash'],'idempotency_key':str(uuid4())}
    assert client.post('/api/orders',json=request,headers=headers()).status_code==409
    current=client.post('/api/checkout/quote',json=data,headers=headers()).json()
    assert current['delivery']=='125.00'
    save_flat(client,'99.00',False)
    assert client.post('/api/checkout/quote',json=data,headers=headers()).status_code==409


def test_ten_rupee_product_plus_delivery_uses_verified_live_amount(client,live):
    save_flat(client)
    with sessions()() as db:
        db.get(Product,'bottle').metadata_json={};db.get(Variant,'sku-bottle').price=10;db.commit()
    items=[{'variant_id':'sku-bottle','quantity':1}]
    quote=client.post('/api/checkout/quote',json={'items':items,'pin':SHIPPING['pin']},headers=headers()).json()
    data={'items':items,'shipping':SHIPPING,'payment':'RAZORPAY','quote_hash':quote['quote_hash'],'idempotency_key':str(uuid4())}
    order=client.post('/api/orders',json=data,headers=headers());assert order.status_code==200,order.text
    order=order.json();assert order['total']=='109.00' and order['delivery']=='99.00'
    checkout=client.post('/api/payments/razorpay/'+order['id']+'/checkout',headers=headers()).json()
    assert checkout['checkout']['amount']==10900
    verified=client.post('/api/payments/razorpay/'+order['id']+'/verify',json=callback(live,checkout),headers=headers())
    assert verified.status_code==200,verified.text
    assert verified.json()['payment_status']=='paid' and verified.json()['order']['total']=='109.00'
    assert client.get('/api/me/orders/'+order['id'],headers=headers()).json()['status']=='Order Confirmed'
    with sessions()() as db:assert db.get(Variant,'sku-bottle').stock==4


def test_flat_setup_preserves_rules_and_later_edits_and_needs_no_preview_measurements(client,monkeypatch):
    monkeypatch.setattr(settings(),'shipping_flat_99_once',True)
    with sessions()() as db:
        original=db.get(StoreDocument,'shipping');before=json.loads(json.dumps(original.value));version=original.version
        apply_flat_delivery(db)
        row=db.get(StoreDocument,'shipping');assert row.value['pricing_mode']=='flat' and row.value['flat_rate']=='99.00'
        assert row.value['confirmed'] and row.version==version+1 and row.value['zones']==ShippingConfig.model_validate(before).model_dump(mode='json')['zones']
        backup=json.loads(gzip.decompress(db.get(StoreSnapshot,'owner-flat-delivery-99-v1').payload))
        assert backup['value']==before
        row.value={**row.value,'flat_rate':'79.00'};db.commit();apply_flat_delivery(db)
        assert db.get(StoreDocument,'shipping').value['flat_rate']=='79.00'
    preview=client.post('/api/admin/delivery/preview',json={'pin':'673661','parcels':5},headers=headers('owner'))
    assert preview.status_code==200,preview.text
    assert preview.json()['delivery']=='79.00' and len(preview.json()['breakdown'])==1
