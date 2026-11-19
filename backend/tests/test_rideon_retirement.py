import gzip
import json
from pathlib import Path

from app.db import sessions
from app.models import Category, Product, StoreDocument, StoreSnapshot, Variant
from app.catalog_retirement import RIDEON_MARKER, retire_rideon_templates


def prepare(db):
    db.add(Category(id='rideon', name='Ride-On', delivery_fee='150'))
    db.add(Product(id='rideon-template', name='Cycle Everyday Essential', category_id='rideon',
                   image='assets/sample.jpg', active=True, sale_enabled=True))
    db.add(Product(id='real-rideon', name='Owner tricycle', category_id='rideon', image='assets/real.jpg',
                   active=True, sale_enabled=True, metadata_json={'owner_photo_import': 'owner-batch'}))
    db.flush()
    db.add(Variant(id='sku-template', product_id='rideon-template', label='', price='10', stock=5))
    db.add(Variant(id='sku-real', product_id='real-rideon', label='Blue', price='2499', stock=10))
    db.commit()
    return [{'id': 'rideon-template', 'name': 'Cycle Everyday Essential', 'expected_image': 'assets/sample.jpg'},
            {'id': 'real-rideon', 'name': 'Owner tricycle', 'expected_image': 'assets/real.jpg'}]


def test_templates_are_archived_without_deleting_products_or_inventory(client):
    with sessions()() as db:
        targets = prepare(db)
        retire_rideon_templates(db, targets); db.commit()
        old = db.get(Product, 'rideon-template'); real = db.get(Product, 'real-rideon')
        assert not old.active and not old.sale_enabled and old.version == 2
        assert old.variants[0].stock == 5 and str(old.variants[0].price) == '10.00'
        assert real.active and real.sale_enabled and real.variants[0].stock == 10
        assert db.get(Product, 'bottle').active
        snapshot = json.loads(gzip.decompress(db.get(StoreSnapshot, RIDEON_MARKER).payload))
        assert snapshot['products'] == [{'id': old.id, 'active': True, 'sale_enabled': True, 'version': 1}]
        assert snapshot['preserved_intervening_edits'] == [real.id]
    assert client.get('/api/catalog/products/rideon-template').status_code == 404
    assert client.get('/api/catalog/products/real-rideon').status_code == 200


def test_intervening_owner_uploads_and_other_categories_are_preserved(client):
    with sessions()() as db:
        targets = prepare(db)
        db.get(Product, 'rideon-template').image = '/api/media/owner-upload'
        targets.append({'id': 'bottle', 'name': 'Baby bottle', 'expected_image': ''})
        db.commit()
        retire_rideon_templates(db, targets); db.commit()
        assert db.get(Product, 'rideon-template').active
        assert db.get(Product, 'bottle').active
        assert db.get(StoreDocument, 'catalog_revision') is None


def test_restart_preserves_later_owner_reactivation(client):
    with sessions()() as db:
        targets = prepare(db)
        retire_rideon_templates(db, targets); db.commit()
        old = db.get(Product, 'rideon-template')
        old.active = old.sale_enabled = True; old.image = '/api/media/real-replacement'
        db.commit()
        revision = db.get(StoreDocument, 'catalog_revision').version
        retire_rideon_templates(db, targets); db.commit()
        assert old.active and old.sale_enabled and old.image == '/api/media/real-replacement'
        assert db.get(StoreDocument, 'catalog_revision').version == revision


def test_retirement_manifest_only_targets_the_observed_demo_listings():
    targets = json.loads((Path(__file__).resolve().parents[1] / 'data/rideon_template_retirement.json').read_text())
    assert len(targets) == 35
    assert all(t['id'].startswith('auto-rideon-') or t['id'] == 'p10' for t in targets)
    assert all(not t['id'].startswith('bo-photo-') for t in targets)
