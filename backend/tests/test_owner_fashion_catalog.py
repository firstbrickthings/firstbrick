import json
from copy import deepcopy
from decimal import Decimal
from hashlib import sha256
from pathlib import Path

from sqlalchemy import select

from app.db import sessions
from app.logistics import LogisticsPolicy, evaluate
from app.models import Category, Product, StoreDocument, StoreSnapshot
from app.owner_fashion_catalog import MARKER, MENU_MARKER, STYLE_CATEGORIES, apply_owner_fashion_catalog, complete_fashion_menu


def prepare(db):
    db.add(Category(id='clothing', name='Clothing', delivery_fee='50'))
    db.add(StoreDocument(key='categories', value={'items': [
        {'id': 'clothing', 'name': 'Clothing', 'img': 'owner-cover.jpg', 'subcategories': ['Party Wear', 'Kids Bags']},
        {'id': 'feeding', 'name': 'Feeding', 'img': 'feeding.jpg', 'subcategories': ['Cutlery']},
    ]}, version=5))
    db.commit()


def test_confirmed_sizes_publish_without_invented_ages_and_preserve_existing_data(client):
    with sessions()() as db:
        prepare(db)
        original = db.get(Product, 'bottle')
        before = (original.name, original.image, original.version, deepcopy(original.metadata_json), original.variants[0].stock)
        apply_owner_fashion_catalog(db); complete_fashion_menu(db); db.commit()
        rows = db.scalars(select(Product).where(Product.id.like('bo-fashion-9d70-%'))).unique().all()
        assert len(rows) == 27
        for p in rows:
            assert p.active and p.sale_enabled
            assert [v.label for v in p.variants] == ['S', 'M', 'L', 'XL']
            assert [v.stock for v in p.variants] == [3, 3, 2, 2]
            assert p.metadata_json['option_type'] == 'size'
            assert p.metadata_json['clothing']['age_range'] is None
            assert p.metadata_json['clothing']['size_source'] == 'owner_confirmed_all_sizes'
            assert all(v.enabled and v.price >= Decimal('1099') for v in p.variants)
            v = p.variants[-1]
            fee, public, report = evaluate(LogisticsPolicy(), {p.id:p}, {v.id:2}, {v.id:v}, '673661', v.price*2, payment='RAZORPAY')
            assert fee == 0 and report['lines'][0]['tier'] == 1
            assert Decimal(report['total_weight_kg']) == Decimal('0.8')
        assert (original.name, original.image, original.version, original.metadata_json, original.variants[0].stock) == before
        menu = db.get(StoreDocument, 'categories')
        assert menu.value['items'][0]['subcategories'] == STYLE_CATEGORIES + ['Party Wear', 'Kids Bags']
        assert menu.value['items'][0]['img'] == 'owner-cover.jpg'
        assert menu.value['items'][1]['subcategories'] == ['Cutlery'] and menu.version == 6
        assert db.get(StoreSnapshot, MARKER) and db.get(StoreSnapshot, MENU_MARKER)
    result = client.get('/api/catalog/products/bo-fashion-9d70-005').json()
    assert len(result['metadata']['galleryImages']) == 3
    assert result['metadata']['unit'] == '1 Set'
    assert 'ageGroup' not in result['metadata'] and 'ageMinMonths' not in result['metadata']


def test_restart_preserves_owner_stock_price_fit_and_menu_edits(client):
    with sessions()() as db:
        prepare(db)
        apply_owner_fashion_catalog(db); complete_fashion_menu(db); db.commit()
        p = db.get(Product, 'bo-fashion-9d70-001')
        p.name = 'Owner edited outfit'; p.sale_enabled = False
        p.variants[-1].stock = 1; p.variants[-1].price = Decimal('1199')
        p.metadata_json = {**p.metadata_json, 'product_details': {'age_range': 'Owner supplied chart'}}
        menu = db.get(StoreDocument, 'categories'); menu.value = {'items': []}
        db.commit(); revision = db.get(StoreDocument, 'catalog_revision').version
        apply_owner_fashion_catalog(db); complete_fashion_menu(db); db.commit()
        assert p.name == 'Owner edited outfit' and not p.sale_enabled
        assert p.variants[-1].stock == 1 and p.variants[-1].price == Decimal('1199')
        assert p.metadata_json['product_details']['age_range'] == 'Owner supplied chart'
        assert menu.value == {'items': []} and db.get(StoreDocument, 'catalog_revision').version == revision


def test_every_source_photo_is_accounted_for_and_duplicate_is_not_republished():
    root = Path(__file__).resolve().parents[2]
    data = json.loads((root/'backend/data/owner_fashion_catalog.json').read_text())
    assert len(data['products']) == 27 and data['source_image_count'] == 34 and data['unique_image_count'] == 33
    sources = [k for p in data['products'] for k in p['source_indices']]
    assert sorted(sources) == [f'F{i:03}' for i in range(1,35)]
    images = {image for p in data['products'] for image in p['gallery']}
    assert len(images) == 33
    for p in data['products']:
        assert p['image'] == p['gallery'][0] and len(p['gallery']) == len(set(p['gallery']))
        assert p['clothing']['age_range'] is None and not p['clothing']['age_size_chart_provided']
        assert [v['label'] for v in p['options']] == ['S','M','L','XL']
        for image in p['gallery']:
            assert sha256((root/image).read_bytes()).hexdigest().startswith(Path(image).stem.split('-')[-1])
