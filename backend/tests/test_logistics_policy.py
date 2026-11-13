"""Deterministic customer fees, conservative weight estimates and private margin reports."""
from decimal import Decimal
import gzip,json
import pytest
from app.config import settings
from app.db import sessions
from app.models import Product,Variant,StoreDocument,StoreSnapshot
from app.logistics import product_tier
from app.logistics_admin import cost_key
from app.shipping_setup import apply_shipping_policy
from conftest import headers
from test_store import SHIPPING
from test_live_payments import live
from test_payments import callback


def configure(client,cod=True):
    doc=client.get('/api/admin/content/shipping',headers=headers('owner')).json()
    value={**doc['value'],'pricing_mode':'policy','confirmed':True,'cod_enabled':cod}
    response=client.put('/api/admin/content/shipping',json={'expected_version':doc['version'],'value':value},headers=headers('owner'));assert response.status_code==200,response.text
    with sessions()() as db:
        p=db.get(Product,'bottle');p.name='Cotton romper';p.metadata_json={};db.get(Variant,'sku-bottle').stock=100;db.get(Variant,'sku-bottle').price=10;db.commit()
    return response.json()


def quote(client,quantity=1,payment='RAZORPAY',pin='673661'):
    return client.post('/api/checkout/quote',json={'items':[{'variant_id':'sku-bottle','quantity':quantity}],'pin':pin,'payment':payment},headers=headers())


def order(client,payment='COD',quantity=1,key='logistics-order-001'):
    q=quote(client,quantity,payment);assert q.status_code==200,q.text
    response=client.post('/api/orders',json={'items':[{'variant_id':'sku-bottle','quantity':quantity}],'shipping':{**SHIPPING,'pin':'673661'},'quote_hash':q.json()['quote_hash'],'idempotency_key':key,'payment':payment},headers=headers());assert response.status_code==200,response.text
    return response.json()


def test_standard_and_free_threshold_use_product_subtotal_only(client):
    configure(client)
    assert quote(client).json()['delivery']=='60.00' and quote(client).json()['total']=='70.00'
    with sessions()() as db:db.get(Variant,'sku-bottle').price=Decimal('598.99');db.commit()
    assert quote(client).json()['delivery']=='60.00'
    with sessions()() as db:db.get(Variant,'sku-bottle').price=Decimal('599');db.commit()
    assert quote(client).json()['delivery']=='0.00'
    assert quote(client,pin='110001').json()['delivery']=='0.00'
    assert quote(client,pin='').json()['delivery_pending']


def test_ten_rompers_are_four_kg_and_consolidate_into_one_box(client):
    configure(client)
    result=order(client,quantity=10)
    report=client.get('/api/admin/orders/'+result['id']+'/logistics',headers=headers('owner')).json()['report']
    assert Decimal(report['total_weight_kg'])==4 and len(report['parcels'])==1
    assert report['parcels'][0]['packaging']=='40.00'
    assert report['actual_india_post_cost'] is None and report['cost_basis']=='owner_reference_estimate'
    assert report['estimated_cost']=={'low':'520.00','high':'630.00'}
    assert report['profit_review']=='product costs required' and report['gross_product_margin'] is None
    assert result['delivery']=='60.00' and 'unit_cost' not in json.dumps(result) and 'gross_product_margin' not in json.dumps(result)


def test_bulky_gear_never_free_and_rejects_cod_and_requires_packed_dimensions_before_dispatch(client,live):
    configure(client)
    with sessions()() as db:
        p=db.get(Product,'bottle');p.name='Electric ride-on car';db.get(Variant,'sku-bottle').price=1000;db.commit()
    q=quote(client).json();assert q['delivery']=='199.00' and q['cod_allowed'] is False
    assert quote(client,payment='COD').status_code==409
    result=order(client,payment='RAZORPAY')
    check=client.post('/api/payments/razorpay/'+result['id']+'/checkout',headers=headers()).json();assert check['checkout']['amount']==119900
    client.post('/api/payments/razorpay/'+result['id']+'/verify',json=callback(live,check),headers=headers()).raise_for_status()
    report=client.get('/api/admin/orders/'+result['id']+'/logistics',headers=headers('owner')).json()['report']
    assert report['estimated_cost']=={'low':'600.00','high':'710.00'}
    assert report['parcels'][0]['packaging']=='120.00' and report['missing_dimensions']==['bottle']
    assert client.patch('/api/admin/orders/'+result['id'],json={'status':'Packed'},headers=headers('owner')).status_code==200
    assert client.patch('/api/admin/orders/'+result['id'],json={'status':'Shipped'},headers=headers('owner')).status_code==409
    with sessions()() as db:
        p=db.get(Product,'bottle');p.metadata_json={'shipping':{'weight_kg':'5','length_cm':'80','width_cm':'40','height_cm':'30','bulky':True}};db.commit()
    assert client.patch('/api/admin/orders/'+result['id'],json={'status':'Shipped'},headers=headers('owner')).status_code==200


def test_measured_weight_wins_and_oversized_limits_are_strict(client):
    configure(client)
    with sessions()() as db:
        p=db.get(Product,'bottle');p.metadata_json={'shipping':{'weight_kg':'.15','length_cm':'20','width_cm':'10','height_cm':'5'}};db.commit()
    result=order(client,quantity=10)
    report=client.get('/api/admin/orders/'+result['id']+'/logistics',headers=headers('owner')).json()['report']
    assert Decimal(report['total_weight_kg'])==Decimal('1.5') and report['lines'][0]['weight_source']=='measured'
    with sessions()() as db:
        p=db.get(Product,'bottle');p.metadata_json={'shipping':{'weight_kg':'5','length_cm':'151','width_cm':'10','height_cm':'10'}};db.commit()
    assert quote(client).status_code==409
    with sessions()() as db:
        p=db.get(Product,'bottle');p.metadata_json={'shipping':{'weight_kg':'5','length_cm':'150','width_cm':'50','height_cm':'50'}};db.commit()
    assert quote(client).status_code==409


def test_costs_are_private_reports_snapshot_prices_and_actual_cost_edits_do_not_change_customer_bill(client):
    configure(client)
    p=client.get('/api/admin/products',headers=headers('owner')).json()['items'][0]
    data={'expected_version':p['version'],'name':p['name'],'category_id':p['category_id'],'variants':p['variants'],'sale_enabled':True,'unit_cost':'2.00','logistics_tier':1}
    saved=client.put('/api/admin/products/bottle',json=data,headers=headers('owner'));assert saved.status_code==200,saved.text
    assert saved.json()['unit_cost']=='2.00'
    assert 'unit_cost' not in json.dumps(client.get('/api/catalog/products/bottle').json())
    assert 'unit_cost' not in json.dumps(client.get('/api/catalog/products').json())
    result=order(client)
    path='/api/admin/orders/'+result['id']+'/logistics'
    assert client.get(path,headers=headers()).status_code==403
    report=client.get(path,headers=headers('owner')).json()
    assert report['report']['gross_product_margin']=='8.00' and report['report']['profit_review']=='shortfall'
    response=client.put(path+'/actual-cost',json={'expected_version':report['version'],'postage_gross':'80','packaging':'20'},headers=headers('owner'));assert response.status_code==200,response.text
    assert response.json()['report']['actual_shipping_contribution']=='-40.00'
    assert response.json()['report']['actual_margin_after_shipping_before_payment_fees']=='-32.00'
    assert client.get('/api/me/orders/'+result['id'],headers=headers()).json()['total']=='70.00'
    assert client.put(path+'/actual-cost',json={'expected_version':report['version'],'postage_gross':'0','packaging':'0'},headers=headers('owner')).status_code==409


def test_bath_tub_is_not_a_light_cosmetic_and_multiple_heavy_units_are_separate_parcels(client,live):
    configure(client)
    with sessions()() as db:
        p=db.get(Product,'bottle');p.name='Foldable Bath Tub';p.metadata_json={'subcategory':'Bath Tubs'};db.commit();assert product_tier(p)==3
    result=order(client,payment='RAZORPAY',quantity=2)
    report=client.get('/api/admin/orders/'+result['id']+'/logistics',headers=headers('owner')).json()['report']
    assert len(report['parcels'])==2 and result['delivery']=='199.00'
    assert report['estimated_cost']=={'low':'1200.00','high':'1420.00'}


def test_large_soft_parcel_requires_a_quote_and_admin_policy_preview_needs_no_fake_measurements(client):
    configure(client)
    assert quote(client,quantity=100).status_code==409
    preview=client.post('/api/admin/delivery/preview',json={'pin':'673661','tier':1,'order_value':'599','parcels':10},headers=headers('owner'));assert preview.status_code==200,preview.text
    assert preview.json()['delivery']=='0' and Decimal(preview.json()['report']['total_weight_kg'])==4
    assert client.post('/api/admin/delivery/preview',json={'pin':'673661','tier':3,'order_value':'1000','payment':'COD'},headers=headers('owner')).status_code==409


def test_new_policy_is_applied_once_and_retains_previous_delivery_rules(client,monkeypatch):
    monkeypatch.setattr(settings(),'shipping_policy_once',True)
    with sessions()() as db:
        before=json.loads(json.dumps(db.get(StoreDocument,'shipping').value));apply_shipping_policy(db)
        assert db.get(StoreDocument,'shipping').value['pricing_mode']=='policy'
        backup=json.loads(gzip.decompress(db.get(StoreSnapshot,'owner-tier-delivery-policy-v1').payload));assert backup['value']==before
        row=db.get(StoreDocument,'shipping');row.value={**row.value,'policy':{**row.value['policy'],'standard_fee':'75.00'}};db.commit();apply_shipping_policy(db)
        assert db.get(StoreDocument,'shipping').value['policy']['standard_fee']=='75.00'
