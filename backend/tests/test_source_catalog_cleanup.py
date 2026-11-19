import gzip,json
from copy import deepcopy
from pathlib import Path
from sqlalchemy import select
from app.db import sessions
from app.models import Category,Product,Variant,StoreSnapshot,StoreDocument,Customer,Order
from app.services import product_view
from app.source_catalog_cleanup import MARKER,approved_product,fingerprint,retire_unapproved_catalog


def prepare(db):
    db.add(Category(id='clothing',name='Clothing',delivery_fee='50'))
    rows=[Product(id='old-sample',name='Old sample outfit',category_id='clothing',sale_enabled=True),
          Product(id='owner-upload',name='Owner outfit',category_id='clothing',sale_enabled=True,metadata_json={'owner_photo_import':'owner-batch'}),
          Product(id='babyone-cetaphil-001',name='Linked cleanser',category_id='feeding',sale_enabled=True)]
    db.add_all(rows);db.flush()
    for p in rows:db.add(Variant(id='sku-'+p.id,product_id=p.id,label='S',stock=5,price='1099'))
    db.commit()
    return {'format':'babyone-source-only-catalogue-v1','targets':[{'id':p.id,'expected_fingerprint':fingerprint(product_view(p))} for p in rows]}


def test_archive_preserves_source_products_stock_prices_and_order_history(client):
    with sessions()() as db:
        data=prepare(db)
        db.add(Customer(uid='history-user',phone='+919999999999',details={}))
        db.flush()
        db.add(Order(id='history-order',customer_uid='history-user',phone='+919999999999',idempotency_key='history',request_hash='x',shipping={},items=[{'id':'old-sample','quantity':1}],subtotal='1099',delivery='60',delivery_breakdown=[],total='1159',payment='COD'))
        # Checkouts can change stock without converting a sample into an owner-supplied listing.
        p=db.get(Product,'old-sample');p.variants[0].stock=4;p.version+=1;db.commit()
        retire_unapproved_catalog(db,data);db.commit()
        assert not p.active and not p.sale_enabled and p.variants[0].stock==4
        assert str(p.variants[0].price)=='1099.00' and db.get(Order,'history-order').items[0]['id']=='old-sample'
        assert db.get(Product,'owner-upload').active and db.get(Product,'babyone-cetaphil-001').active
        assert db.get(Product,'bottle').active  # Not in the reviewed target list.
        snapshot=json.loads(gzip.decompress(db.get(StoreSnapshot,MARKER).payload))
        assert [p['id'] for p in snapshot['products']]==['old-sample']
        assert set(snapshot['preserved_intervening_edits'])=={'owner-upload','babyone-cetaphil-001'}
    assert client.get('/api/catalog/products/old-sample').status_code==404
    assert client.get('/api/catalog/products/owner-upload').status_code==200


def test_intervening_owner_edits_and_later_reactivation_survive(client):
    with sessions()() as db:
        data=prepare(db);p=db.get(Product,'old-sample');p.image='/api/media/owner-replacement';db.commit()
        retire_unapproved_catalog(db,data);db.commit();assert p.active
        revision=db.get(StoreDocument,'catalog_revision')
        assert revision is None
        p.active=False;db.commit();retire_unapproved_catalog(db,data);db.commit();assert not p.active
        assert db.get(StoreDocument,'catalog_revision') is None


def test_manifest_only_retires_reviewed_non_source_listings():
    root=Path(__file__).resolve().parents[2]
    data=json.loads((root/'backend/data/source_catalog_cleanup.json').read_text())
    kept=set(data['kept_product_ids']);targets={p['id'] for p in data['targets']}
    assert len(kept)==227 and len(targets)==635 and not kept&targets
    for name in ['owner_photo_catalog.json','owner_toy_catalog.json','owner_fashion_catalog.json']:
        source=json.loads((root/'backend/data'/name).read_text())
        assert {p['id'] for p in source['products']}<=kept
    assert not any(approved_product({'id':p['id'],'metadata':{}}) for p in data['targets'])


def test_source_photo_repair_keeps_inventory_and_later_owner_upload(client):
    from app.source_catalog_cleanup import repair_linked_source_photos
    with sessions()() as db:
        prepare(db);p=db.get(Product,'babyone-cetaphil-001');p.image='broken-source.jpg';db.commit()
        repairs=[{'id':p.id,'expected_image':'broken-source.jpg','image':'assets/correct-source.jpg',
                  'gallery':['assets/correct-source.jpg'],'source':'https://manufacturer.example/product','source_title':'Linked cleanser'}]
        repair_linked_source_photos(db,repairs);db.commit()
        assert p.image=='assets/correct-source.jpg' and p.variants[0].stock==5
        assert str(p.variants[0].price)=='1099.00' and p.metadata_json['image_reference'] is False
        p.image='/api/media/owner-replacement';db.commit()
        repair_linked_source_photos(db,repairs);db.commit()
        assert p.image=='/api/media/owner-replacement'
