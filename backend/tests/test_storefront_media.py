import gzip
import json
from sqlalchemy import select
from app.db import sessions
from app.models import Product, StoreDocument, StoreSnapshot, Variant
from app.storefront_media import MARKER, apply_storefront_media


def manifest():
    return {'products': [{'id': 'bottle', 'name': 'Baby bottle', 'expected_image': '',
                          'image': 'https://cdn.example.com/bottle.webp', 'gallery': ['https://cdn.example.com/bottle.webp'],
                          'reference': True, 'source': 'https://supplier.example.com/bottle', 'source_title': 'Bottle photograph'}],
            'categories': [{'id': 'feeding', 'name': 'Feeding', 'img': 'new-cover.webp', 'subcategories': ['Bottles']}],
            'category_updates': [{'id': 'feeding', 'expected_image': 'old-cover.webp', 'image': 'new-cover.webp'}],
            'banners': [{'id': 'promo1-0', 'image': 'banner.webp'}, {'id': 'fashion-0', 'image': 'clothes.webp'}]}


def test_photos_update_once_without_changing_commerce_data(client):
    with sessions()() as db:
        p = db.get(Product, 'bottle')
        before = (p.name, p.description, p.active, p.sale_enabled, p.category_id, p.version)
        inventory = [(v.id, str(v.price), v.stock, v.enabled) for v in db.scalars(select(Variant))]
        shipping = db.get(StoreDocument, 'shipping').value
        apply_storefront_media(db, manifest()); db.commit()
        assert (p.name, p.description, p.active, p.sale_enabled, p.category_id, p.version) == (*before[:-1], before[-1] + 1)
        assert p.image == 'https://cdn.example.com/bottle.webp'
        assert p.metadata_json['shipping']['weight_kg'] == '0.5'
        assert p.metadata_json['galleryImages'] == [p.image] and p.metadata_json['image_reference'] is True
        assert inventory == [(v.id, str(v.price), v.stock, v.enabled) for v in db.scalars(select(Variant))]
        assert db.get(StoreDocument, 'shipping').value == shipping
        undo = json.loads(gzip.decompress(db.get(StoreSnapshot, MARKER).payload))
        assert undo['products'][0]['image'] == ''
        assert undo['products'][0]['metadata']['shipping']['weight_kg'] == '0.5'
        assert db.get(StoreDocument, 'banners').value['items'][0]['id'] == 'promo1-0'
        # A later owner replacement survives restarts, including its catalogue version.
        p.image = '/api/media/owner-replacement'; p.version += 1; db.commit()
        version = p.version
        apply_storefront_media(db, manifest()); db.commit()
        assert p.image == '/api/media/owner-replacement' and p.version == version


def test_intervening_owner_uploads_and_existing_published_banners_survive():
    with sessions()() as db:
        p = db.get(Product, 'bottle'); p.image = '/api/media/customer-upload'
        for key in ['hero', 'banners', 'fashion']:
            db.add(StoreDocument(key=key, value={'items': [{'id': 'owner-' + key, 'image': '/api/media/owner-art', 'videoUrl': '/api/media/owner-video'}]}, version=8))
        db.add(StoreDocument(key='categories', value={'items': [{'id': 'feeding', 'name': 'Owner name', 'img': '/api/media/owner-cover', 'subcategories': ['Owner section']}]}, version=4))
        db.commit()
        apply_storefront_media(db, manifest()); db.commit()
        assert p.image == '/api/media/customer-upload'
        for key in ['hero', 'banners', 'fashion']:
            assert db.get(StoreDocument, key).version == 8
            assert db.get(StoreDocument, key).value['items'][0]['videoUrl'] == '/api/media/owner-video'
        assert db.get(StoreDocument, 'categories').value['items'][0]['subcategories'] == ['Owner section']
        assert db.get(StoreDocument, 'categories').version == 4


def test_default_cover_replacement_preserves_navigation():
    with sessions()() as db:
        db.add(StoreDocument(key='categories', value={'items': [{'id': 'feeding', 'name': 'Feeding', 'img': 'old-cover.webp', 'subcategories': ['Bottles', 'Cups']}]}, version=3))
        db.commit()
        apply_storefront_media(db, manifest()); db.commit()
        doc = db.get(StoreDocument, 'categories')
        assert doc.value['items'][0] == {'id': 'feeding', 'name': 'Feeding', 'img': 'new-cover.webp', 'subcategories': ['Bottles', 'Cups']}
        assert doc.version == 4
