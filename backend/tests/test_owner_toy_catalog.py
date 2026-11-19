import json
from copy import deepcopy
from decimal import Decimal
from hashlib import sha256
from pathlib import Path

from sqlalchemy import select

from app.db import sessions
from app.models import Category, Product, StoreDocument, StoreSnapshot
from app.owner_toy_catalog import MARKER, MENU_MARKER, apply_owner_toy_catalog, complete_owner_catalog_menu


def prepare(db):
    for name in ['Toys & Learning', 'Clothing', 'Bath & Skincare', 'Potty']:
        db.add(Category(id=name, name=name, delivery_fee='60'))
    db.add(Product(id='bo-photo-3bc4-007', name='Existing green potty chair', category_id='Potty',
                   image='assets/green-potty.jpg', active=True, sale_enabled=True))
    db.add(StoreDocument(key='categories', value={'items': [
        {'id': 'toys', 'name': 'Toys & Learning', 'img': 'owner-toys.jpg', 'subcategories': ['Owner range', 'RC Toys']},
        {'id': 'clothes', 'name': 'Clothing', 'img': 'owner-clothes.jpg', 'subcategories': ['Onesies']},
    ]}, version=3))
    db.commit()


def test_all_61_products_are_purchasable_and_existing_data_survives(client):
    with sessions()() as db:
        prepare(db)
        original = db.get(Product, 'bottle')
        before = (original.name, original.version, deepcopy(original.metadata_json), original.variants[0].stock)
        apply_owner_toy_catalog(db)
        complete_owner_catalog_menu(db)
        db.commit()
        rows = db.scalars(select(Product).where(Product.id.like('bo-toys-261117-%'))).unique().all()
        assert len(rows) == 61
        assert all(p.active and p.sale_enabled and sum(v.stock for v in p.variants) == 10 for p in rows)
        assert all(v.enabled and v.price >= Decimal('1099') for p in rows for v in p.variants)
        assert (original.name, original.version, original.metadata_json, original.variants[0].stock) == before
        menu = db.get(StoreDocument, 'categories')
        items = {c['name']: c for c in menu.value['items']}
        assert items['Potty']['img'] == 'assets/green-potty.jpg'
        assert items['Potty']['subcategories'][0] == 'Potty Set'
        assert items['Toys & Learning']['img'] == 'owner-toys.jpg'
        assert items['Toys & Learning']['subcategories'] == ['Owner range', 'RC Toys', 'Musical Toys']
        assert items['Clothing']['subcategories'] == ['Onesies', 'Kids Bags']
        assert menu.version == 4
        assert db.get(StoreSnapshot, MARKER) and db.get(StoreSnapshot, MENU_MARKER)
    public = client.get('/api/catalog/products/bo-toys-261117-001').json()
    assert len(public['metadata']['galleryImages']) == 7 and public['sale_enabled']
    bath = client.get('/api/catalog/products/bo-toys-261117-002').json()
    assert bath['metadata']['catalogueNavigationGroup'] == 'Accessories'


def test_restart_keeps_owner_stock_price_and_menu_edits(client):
    with sessions()() as db:
        prepare(db)
        apply_owner_toy_catalog(db); complete_owner_catalog_menu(db); db.commit()
        p = db.get(Product, 'bo-toys-261117-001')
        p.name = 'Owner updated rattle'; p.image = '/api/media/new-rattle'
        p.variants[0].stock = 3; p.variants[0].price = Decimal('1799')
        menu = db.get(StoreDocument, 'categories')
        menu.value = {'items': [{'id': 'owner', 'name': 'Owner menu', 'subcategories': []}]}
        db.commit()
        revision = db.get(StoreDocument, 'catalog_revision').version
        apply_owner_toy_catalog(db); complete_owner_catalog_menu(db); db.commit()
        assert p.name == 'Owner updated rattle' and p.image == '/api/media/new-rattle'
        assert p.variants[0].stock == 3 and p.variants[0].price == Decimal('1799')
        assert menu.value['items'][0]['name'] == 'Owner menu'
        assert db.get(StoreDocument, 'catalog_revision').version == revision


def test_manifest_covers_306_original_photos_and_keeps_variant_photos_matched():
    root = Path(__file__).resolve().parents[2]
    data = json.loads((root / 'backend/data/owner_toy_catalog.json').read_text())
    assert len(data['products']) == 61 and len(data['source_archives']) == 6
    sources = [k for p in data['products'] for k in p['source_indices']]
    assert len(sources) == len(set(sources)) == 306
    assert all(p['category'] != 'Ride-On' for p in data['products'])  # RC models are toys.
    for p in data['products']:
        assert p['image'] == p['gallery'][0]
        assert sum(v['stock'] for v in p['options']) == 10
        assert all(set(v.get('images', [])) <= set(p['gallery']) for v in p['options'])
        for image in p['gallery']:
            assert sha256((root / image).read_bytes()).hexdigest().startswith(Path(image).stem.split('-')[-1])
