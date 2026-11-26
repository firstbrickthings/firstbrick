import json
from pathlib import Path
from sqlalchemy import select
from app.db import sessions
from app.models import Category, Product, StoreDocument, Variant
from app.owner_nov26_catalog import apply_owner_nov26_catalog, COLLECTIONS


def test_import_photos_once_and_preserve_existing_commerce_and_menus():
    with sessions()() as db:
        for name in ['Toys & Learning','Bath & Skincare','Potty','Clothing']:
            db.add(Category(id=name,name=name))
        db.flush()
        db.add(Product(id='bo-photo-3bc4-008',name='Existing tub',category_id='Bath & Skincare',image='assets/old.jpg',metadata_json={'galleryImages':['assets/old.jpg']}))
        db.add(Variant(id='existing-tub-v',product_id='bo-photo-3bc4-008',label='Blue',price=1750,stock=4))
        db.add(StoreDocument(key='categories',value={'items':[{'id':name,'name':name,'img':'assets/cover.jpg','subcategories':['Owner range']} for name in ['Clothing','Toys & Learning','Bath & Skincare','Potty']]},version=1));db.commit()
        original=db.get(Product,'bottle');before=(original.version,original.image,original.sale_enabled,original.variants[0].stock)
        apply_owner_nov26_catalog(db);db.commit()
        added=db.scalars(select(Product).where(Product.id.like('bo-new-261126-%'))).unique().all()
        assert len(added)==38
        assert all(p.active and p.sale_enabled and sum(v.stock for v in p.variants)==10 for p in added)
        assert all(p.image==p.metadata_json['galleryImages'][0] for p in added)
        assert all(len(p.metadata_json['galleryImages'])>1 for p in added)
        assert all(v.price>=1099 for p in added for v in p.variants)
        assert (original.version,original.image,original.sale_enabled,original.variants[0].stock)==before
        tub=db.get(Product,'bo-photo-3bc4-008');assert tub.image=='assets/old.jpg' and len(tub.metadata_json['galleryImages'])==11
        assert tub.variants[0].stock==4 and tub.variants[0].price==1750
        menu=db.get(StoreDocument,'categories');clothes=next(c for c in menu.value['items'] if c['name']=='Clothing')
        assert clothes['subcategories']==COLLECTIONS
        assert all(c['img']=='assets/cover.jpg' for c in menu.value['items'])
        version=menu.version;tub_version=tub.version
        added[0].variants[0].stock=2;db.commit();apply_owner_nov26_catalog(db);db.commit()
        assert added[0].variants[0].stock==2 and menu.version==version and tub.version==tub_version


def test_manifest_uses_real_assets_and_each_source_has_one_product():
    root=Path(__file__).resolve().parents[2]
    manifest=json.loads((root/'backend/data/owner_nov26_catalog.json').read_text())
    ids=[i for p in manifest['products'] for i in p['source_indices']]
    assert len(ids)==len(set(ids))
    for p in manifest['products']:
        assert len(p['gallery'])==len(set(p['gallery']))
        for photo in p['gallery']:assert (root/photo).is_file()
