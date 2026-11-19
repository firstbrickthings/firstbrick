import gzip,json
from copy import deepcopy
from app.db import sessions
from app.models import Product,StoreSnapshot,StoreDocument
from app.services import product_view
from app.undo_source_cleanup import MARKER,ARCHIVE_SNAPSHOT,PHOTO_SNAPSHOT,fingerprint,restore_previous_catalog


def setup_archive(db):
    p=db.get(Product,'bottle');record=product_view(p)
    manifest={'format':'babyone-undo-source-cleanup-v1','archived_products':{p.id:fingerprint(record)},'photo_repairs':[]}
    db.add(StoreSnapshot(id=ARCHIVE_SNAPSHOT,payload=gzip.compress(json.dumps({'products':[{'id':p.id,'active':True,'sale_enabled':True,'version':p.version}]}).encode())))
    p.active=p.sale_enabled=False;p.version+=1;db.commit()
    return p,manifest


def test_restore_product_keeps_new_stock_and_monotonic_version(client):
    with sessions()() as db:
        p,manifest=setup_archive(db)
        p.variants[0].stock=2;p.version+=1;db.commit();version=p.version
        restore_previous_catalog(db,manifest);db.commit()
        assert p.active and p.sale_enabled and p.variants[0].stock==2
        assert str(p.variants[0].price)=='499.00' and p.version==version+1
        state=json.loads(gzip.decompress(db.get(StoreSnapshot,MARKER).payload))
        assert state['restored_products']==['bottle'] and not state['preserved_later_edits']
    assert client.get('/api/catalog/products/bottle').status_code==200


def test_preserve_a_later_owner_edit_and_do_not_repeat_restore(client):
    with sessions()() as db:
        p,manifest=setup_archive(db);p.name='Later owner edit';db.commit()
        restore_previous_catalog(db,manifest);db.commit()
        assert not p.active and p.name=='Later owner edit'
        p.active=p.sale_enabled=True;db.commit();version=p.version
        restore_previous_catalog(db,manifest);db.commit()
        assert p.active and p.version==version


def test_photo_restore_merges_only_our_changed_fields(client):
    with sessions()() as db:
        p=db.get(Product,'bottle');old=deepcopy(p.metadata_json);p.image='assets/cached.jpg'
        applied={'id':p.id,'image':p.image,'gallery':['assets/cached.jpg'],'source':'https://supplier.example/photo','source_title':'Bottle'}
        p.metadata_json={**old,'galleryImages':applied['gallery'],'images':applied['gallery'],'image_source':applied['source'],'image_source_title':applied['source_title'],'image_reference':False,'product_details':{'material':'Later owner specification'}}
        db.add(StoreSnapshot(id=PHOTO_SNAPSHOT,payload=gzip.compress(json.dumps([{'id':p.id,'image':'original.jpg','metadata':old,'version':1}]).encode())))
        db.commit()
        manifest={'format':'babyone-undo-source-cleanup-v1','archived_products':{},'photo_repairs':[applied]}
        restore_previous_catalog(db,manifest);db.commit()
        assert p.image=='original.jpg' and p.metadata_json=={**old,'product_details':{'material':'Later owner specification'}}
        assert p.variants[0].stock==5 and str(p.variants[0].price)=='499.00'
        p.image='owner-replacement.jpg';db.commit();restore_previous_catalog(db,manifest);db.commit()
        assert p.image=='owner-replacement.jpg'
