import gzip
import json
import pytest
from sqlalchemy import select
from app.db import sessions
from app.models import Product, StoreDocument, StoreSnapshot, Variant
from app.undo_campaign_media import MARKER, SOURCE, fingerprint, restore_previous_media


def prepare(db):
    originals = {key: {'value': {'items': [{'id': 'old-' + key, 'image': 'assets/old.webp'}]}, 'version': 3}
                 for key in ['hero', 'banners', 'fashion']}
    originals['videos'] = {'value': {'items': [{'id': 'old-video', 'title': 'Original video', 'videoUrl': 'assets/original.mp4'}]}, 'version': 1}
    db.add(StoreSnapshot(id=SOURCE, payload=gzip.compress(json.dumps(originals).encode())))
    expected = {}
    for key in originals:
        value = {'items': []} if key == 'videos' else {'items': [{'id': 'cancelled-' + key, 'image': 'assets/cancelled.webp', 'editorial': True}]}
        db.add(StoreDocument(key=key, value=value, version=4))
        expected[key] = {'version': 4, 'sha256': fingerprint(value)}
    db.commit()
    return originals, expected


def test_previous_images_banners_and_videos_return_without_commerce_changes():
    with sessions()() as db:
        originals, expected = prepare(db)
        product = db.get(Product, 'bottle')
        before = (product.version, product.image, product.metadata_json,
                  [(v.id, str(v.price), v.stock, v.enabled) for v in db.scalars(select(Variant))],
                  db.get(StoreDocument, 'shipping').value)
        restore_previous_media(db, expected); db.commit()
        for key, original in originals.items():
            assert db.get(StoreDocument, key).value == original['value']
            assert db.get(StoreDocument, key).version == 5
        assert before == (product.version, product.image, product.metadata_json,
                          [(v.id, str(v.price), v.stock, v.enabled) for v in db.scalars(select(Variant))],
                          db.get(StoreDocument, 'shipping').value)
        assert json.loads(gzip.decompress(db.get(StoreSnapshot, MARKER).payload))['before']['videos']['value'] == {'items': []}
        # An owner edit after restoration remains authoritative on later deploys.
        db.get(StoreDocument, 'hero').value = {'items': []}
        db.get(StoreDocument, 'hero').version = 6
        db.commit(); restore_previous_media(db, expected); db.commit()
        assert db.get(StoreDocument, 'hero').value == {'items': []}
        assert db.get(StoreDocument, 'hero').version == 6


def test_all_sections_are_checked_before_any_are_restored():
    with sessions()() as db:
        _, expected = prepare(db)
        db.get(StoreDocument, 'hero').version = 5; db.commit()
        with pytest.raises(RuntimeError, match='hero'):
            restore_previous_media(db, expected)
        assert db.get(StoreDocument, 'banners').value['items'][0]['id'] == 'cancelled-banners'
        assert db.get(StoreDocument, 'videos').value == {'items': []}
        assert db.get(StoreSnapshot, MARKER) is None


def test_fresh_install_without_cancelled_release_is_unchanged():
    with sessions()() as db:
        restore_previous_media(db, {}); db.commit()
        assert db.get(StoreDocument, 'hero') is None
        assert db.get(StoreSnapshot, MARKER) is None
