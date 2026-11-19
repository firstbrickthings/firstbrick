import gzip
import json
from copy import deepcopy
from decimal import Decimal
from pathlib import Path

from sqlalchemy import select

from app.db import sessions
from app.logistics import LogisticsPolicy, customer_fee, evaluate, product_tier
from app.models import Product, StoreDocument, StoreSnapshot
from app.owner_photo_catalog import MARKER, apply_owner_photo_catalog
from conftest import headers


def manifest():
    return {'batch_id': '3bc48208', 'source_sha256': 'photo-source-fixture', 'products': [
        {'id': 'owner-photo-test', 'name': 'Activity Walker', 'category': 'Feeding',
         'subcategory': 'High Chairs', 'brand': '', 'description': 'A factual description.',
         'image': 'assets/blue.jpg', 'gallery': ['assets/blue.jpg', 'assets/detail.jpg', 'assets/pink.jpg'],
         'unit': '1 Piece', 'logistics_tier': 3, 'source_indices': [1, 2, 3],
         'options': [{'label': 'Blue', 'price': '1799.00', 'stock': 5, 'images': ['assets/blue.jpg', 'assets/detail.jpg']},
                     {'label': 'Pink', 'price': '1799.00', 'stock': 5, 'images': ['assets/pink.jpg']}]}]}


def test_grouped_photos_are_live_with_ten_total_stock_and_correct_option_galleries(client):
    with sessions()() as db:
        original = db.get(Product, 'bottle')
        before = (original.name, original.image, original.active, original.sale_enabled, original.version, deepcopy(original.metadata_json))
        existing_inventory = [(v.id, str(v.price), v.stock) for v in original.variants]
        apply_owner_photo_catalog(db, manifest()); db.commit()
        p = db.get(Product, 'owner-photo-test')
        assert p.active and p.sale_enabled
        assert len(p.variants) == 2 and sum(v.stock for v in p.variants) == 10
        assert all(v.price == Decimal('1799') and v.enabled for v in p.variants)
        assert p.metadata_json['galleryImages'] == ['assets/blue.jpg', 'assets/detail.jpg', 'assets/pink.jpg']
        assert p.metadata_json['variant_images']['Pink'] == ['assets/pink.jpg']
        assert product_tier(p) == 3
        assert (original.name, original.image, original.active, original.sale_enabled, original.version, original.metadata_json) == before
        assert [(v.id, str(v.price), v.stock) for v in original.variants] == existing_inventory
        assert db.get(StoreDocument, 'shipping').value['confirmed'] is True
        snapshot = json.loads(gzip.decompress(db.get(StoreSnapshot, MARKER).payload))
        assert snapshot['created_product_ids'] == [p.id]
    public = client.get('/api/catalog/products/owner-photo-test').json()
    assert public['sale_enabled'] is True and public['metadata']['unit'] == '1 Piece'
    assert len(public['metadata']['galleryImages']) == 3


def test_restart_preserves_owner_edits_and_stock_changes(client):
    with sessions()() as db:
        apply_owner_photo_catalog(db, manifest()); db.commit()
        p = db.get(Product, 'owner-photo-test')
        p.name = 'Owner edited name'; p.image = '/api/media/owner-replacement'; p.active = False
        p.variants[0].price = Decimal('2999'); p.variants[0].stock = 3
        db.commit()
        revision = db.get(StoreDocument, 'catalog_revision').version
        apply_owner_photo_catalog(db, manifest()); db.commit()
        assert p.name == 'Owner edited name' and p.image == '/api/media/owner-replacement' and not p.active
        assert p.variants[0].stock == 3 and p.variants[0].price == Decimal('2999')
        assert db.get(StoreDocument, 'catalog_revision').version == revision
        assert len(db.scalars(select(Product).where(Product.id == p.id)).all()) == 1


def test_purchasable_colours_keep_their_photos_and_use_the_weight_policy(client):
    with sessions()() as db:
        apply_owner_photo_catalog(db, manifest())
        shipping = db.get(StoreDocument, 'shipping')
        shipping.value = {**shipping.value, 'pricing_mode': 'policy'}
        db.commit()
        p = db.get(Product, 'owner-photo-test'); pink = p.variants[1]
        variant_id = pink.id
        fee, public, report = evaluate(LogisticsPolicy(), {p.id: p}, {pink.id: 2}, {pink.id: pink}, '673661', Decimal('3598'), cod_enabled=True)
        assert fee == 199 and public['cod_allowed'] is False
        assert Decimal(report['total_weight_kg']) == 10
        assert len(report['parcels']) == 2 and report['lines'][0]['weight_source'] == 'owner_default'
    data = {'items': [{'variant_id': variant_id, 'quantity': 2}], 'pin': '673661', 'payment': 'RAZORPAY'}
    response = client.post('/api/checkout/quote', json=data, headers=headers())
    assert response.status_code == 200, response.text
    quote = response.json()
    assert quote['delivery'] == '199.00' and quote['subtotal'] == '3598.00'
    assert quote['items'][0]['image'] == 'assets/pink.jpg'
    assert client.post('/api/checkout/quote', json={**data, 'payment': 'COD'}, headers=headers()).status_code == 409


def test_existing_import_ids_are_never_overwritten_without_a_marker(client):
    with sessions()() as db:
        data = manifest(); data['products'][0]['id'] = 'bottle'
        apply_owner_photo_catalog(db, data); db.commit()
        p = db.get(Product, 'bottle')
        assert p.name == 'Baby bottle' and p.variants[0].price == Decimal('499') and p.variants[0].stock == 5
        assert p.image == ''


def test_complete_manifest_covers_every_photo_once_and_has_only_matching_galleries():
    root = Path(__file__).resolve().parents[2]
    data = json.loads((root / 'backend/data/owner_photo_catalog.json').read_text())
    assert len(data['products']) == 38 and data['unique_image_count'] == 99
    assert sorted(i for p in data['products'] for i in p['source_indices']) == list(range(1, 101))
    images = {image for p in data['products'] for image in p['gallery']}
    assert len(images) == 99 and all((root / image).is_file() for image in images)
    policy = LogisticsPolicy()
    for entry in data['products']:
        assert sum(option['stock'] for option in entry['options']) == 10
        assert all(Decimal(option['price']) >= 1099 for option in entry['options'])
        assert entry['gallery'][0] == entry['image'] and len(set(entry['gallery'])) == len(entry['gallery'])
        assert all(set(option.get('images', [])) <= set(entry['gallery']) for option in entry['options'])
        fee, public = customer_fee(policy, [entry['logistics_tier']], Decimal(entry['options'][0]['price']), 'RAZORPAY', True)
        assert fee == (199 if entry['logistics_tier'] == 3 else 0)
        assert public['cod_allowed'] is (entry['logistics_tier'] != 3)
