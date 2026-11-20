import gzip
import json
import pytest
from sqlalchemy import select
from app.campaign_media import MARKER, apply_campaign_media
from app.db import sessions
from app.models import Product, StoreDocument, StoreSnapshot, Variant
from conftest import headers


def manifest():
    return {'documents': {key: {'expected_version': 0, 'value': {'items': [{
        'id': key + '-campaign', 'image': 'assets/campaign/ride-wide.webp',
        'imageMobile': 'assets/campaign/ride-portrait.webp', 'editorial': True,
        'title': 'Little moments.\nBig adventures.', 'category': 'Ride-On', 'published': True,
    }]}} for key in ['hero', 'banners', 'fashion']}}


def test_campaign_replaces_only_media_once_and_retains_recovery_data():
    with sessions()() as db:
        old = {'items': [{'id': 'previous', 'image': 'assets/previous.webp'}]}
        db.add(StoreDocument(key='hero', value=old, version=6))
        db.add(StoreDocument(key='videos', value={'items': []}, version=3))
        db.commit()
        data = manifest(); data['documents']['hero']['expected_version'] = 6
        product = db.get(Product, 'bottle')
        commerce = (product.version, product.image, product.metadata_json,
                    [(v.id, str(v.price), v.stock, v.enabled) for v in db.scalars(select(Variant))],
                    db.get(StoreDocument, 'shipping').value)
        apply_campaign_media(db, data); db.commit()
        assert db.get(StoreDocument, 'hero').version == 7
        assert db.get(StoreDocument, 'hero').value == data['documents']['hero']['value']
        snapshot = json.loads(gzip.decompress(db.get(StoreSnapshot, MARKER).payload))
        assert snapshot['hero'] == {'value': old, 'version': 6}
        assert snapshot['banners'] is None
        assert commerce == (product.version, product.image, product.metadata_json,
                            [(v.id, str(v.price), v.stock, v.enabled) for v in db.scalars(select(Variant))],
                            db.get(StoreDocument, 'shipping').value)
        assert db.get(StoreDocument, 'videos').version == 3
        # Restarts never restore campaign defaults over a subsequent owner edit.
        db.get(StoreDocument, 'hero').value = old
        db.get(StoreDocument, 'hero').version = 8
        db.commit(); apply_campaign_media(db, data); db.commit()
        assert db.get(StoreDocument, 'hero').value == old
        assert db.get(StoreDocument, 'hero').version == 8


def test_campaign_checks_all_versions_before_replacing_any_document():
    with sessions()() as db:
        old = {'items': [{'id': 'owner', 'image': 'assets/owner.webp'}]}
        db.add(StoreDocument(key='hero', value=old, version=1)); db.commit()
        with pytest.raises(RuntimeError, match='hero'):
            apply_campaign_media(db, manifest())
        assert db.get(StoreDocument, 'banners') is None
        assert db.get(StoreDocument, 'fashion') is None
        assert db.get(StoreDocument, 'hero').value == old
        assert db.get(StoreSnapshot, MARKER) is None


def test_requested_video_removal_retains_the_previous_published_list():
    with sessions()() as db:
        old = {'items': [{'id': 'previous-clip', 'title': 'Previous clip', 'videoUrl': 'assets/previous.mp4'}]}
        db.add(StoreDocument(key='videos', value=old, version=3)); db.commit()
        data = {'documents': {'videos': {'expected_version': 3, 'value': {'items': []}}}}
        apply_campaign_media(db, data); db.commit()
        assert db.get(StoreDocument, 'videos').value == {'items': []}
        assert db.get(StoreDocument, 'videos').version == 4
        snapshot = json.loads(gzip.decompress(db.get(StoreSnapshot, MARKER).payload))
        assert snapshot['videos'] == {'value': old, 'version': 3}


def test_responsive_campaign_fields_publish_and_reject_unsafe_values(client):
    for key in ['hero', 'banners', 'fashion']:
        entry = manifest()['documents'][key]
        response = client.put('/api/admin/content/' + key, json=entry, headers=headers('owner'))
        assert response.status_code == 200, response.text
        assert client.get('/api/store/content').json()[key]['value'] == entry['value']
        for bad in [{'imageMobile': 'javascript:alert(1)'}, {'editorial': 'true'}, {'kicker': {}}]:
            item = {**entry['value']['items'][0], **bad}
            response = client.put('/api/admin/content/' + key,
                                  json={'expected_version': 1, 'value': {'items': [item]}},
                                  headers=headers('owner'))
            assert response.status_code == 422, response.text
