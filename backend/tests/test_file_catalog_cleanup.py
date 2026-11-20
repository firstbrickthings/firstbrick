import gzip
import json
from sqlalchemy import select
from app.db import sessions
from app.models import Category, Product, StoreDocument, StoreSnapshot, Variant
from app.file_catalog_cleanup import MARKER, archive_reviewed_legacy_products
from conftest import headers


def test_archive_keeps_uploads_skin_care_inventory_and_all_menus(client):
    menu={'items':[{'id':'feeding','name':'Feeding','subcategories':['Bottles','Pumps']},{'id':'bath','name':'Bath & Skincare','subcategories':['Wash']}]}
    with sessions()() as db:
        db.add(Category(id='bath',name='Bath & Skincare'));db.flush()
        db.add_all([
            Product(id='zip',name='Owner toy',category_id='feeding',metadata_json={'owner_photo_import':'zip-batch'}),
            Product(id='uploaded',name='Dashboard upload',category_id='feeding',image='/api/media/file'),
            Product(id='skin',name='Linked skincare',category_id='bath',image='https://example.com/skin.jpg'),
            StoreDocument(key='categories',value=menu,version=8)])
        db.commit()
        stock=[(v.id,str(v.price),v.stock,v.enabled) for v in db.scalars(select(Variant))]
        archive_reviewed_legacy_products(db,['bottle','zip','uploaded','skin']);db.commit()
        bottle=db.get(Product,'bottle');assert not bottle.active and not bottle.sale_enabled
        assert all(db.get(Product,i).active for i in ['zip','uploaded','skin'])
        assert stock==[(v.id,str(v.price),v.stock,v.enabled) for v in db.scalars(select(Variant))]
        doc=db.get(StoreDocument,'categories');assert doc.value==menu and doc.version==8
        snap=json.loads(gzip.decompress(db.get(StoreSnapshot,MARKER).payload))
        assert snap['products']==[{'id':'bottle','active':True,'sale_enabled':True,'version':1}]
        assert set(snap['preserved_later_uploads'])=={'zip','uploaded','skin'}
    assert client.get('/api/catalog/products/bottle').status_code==404
    assert client.get('/api/catalog/products?q=Baby%20bottle').json()['total']==0
    archived=client.get('/api/admin/products?q=bottle',headers=headers('owner')).json()['items']
    assert any(p['id']=='bottle' and not p['active'] for p in archived)


def test_future_dashboard_products_are_not_removed_on_restart(client):
    with sessions()() as db:
        archive_reviewed_legacy_products(db,['bottle']);db.commit()
        version=db.get(Product,'bottle').version
        db.add(Product(id='later',name='New dashboard product',category_id='feeding'));db.commit()
        archive_reviewed_legacy_products(db,['bottle','later']);db.commit()
        assert db.get(Product,'later').active
        assert db.get(Product,'bottle').version==version
        assert db.get(Category,'feeding')
    assert client.get('/api/catalog/products?category=feeding').json()['total']==1
