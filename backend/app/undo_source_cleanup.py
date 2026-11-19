"""Restore the preceding catalogue release while retaining later stock and order activity."""
import gzip
import hashlib
import json
from pathlib import Path

from sqlalchemy import select

from .models import Product, StoreSnapshot
from .services import product_view, touch_catalog

MARKER = 'catalogue:undo-approved-sources-cleanup-v1'
ARCHIVE_SNAPSHOT = 'catalogue:approved-sources-only-v1'
PHOTO_SNAPSHOT = 'storefront:linked-source-photo-repairs-v1'
PHOTO_KEYS = ('galleryImages', 'images', 'image_source', 'image_source_title', 'image_reference')


def fingerprint(record):
    data = {key: value for key, value in record.items() if key != 'version'}
    data['variants'] = [{key: value for key, value in variant.items() if key != 'stock'}
                        for variant in record['variants']]
    return hashlib.sha256(json.dumps(data, sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode()).hexdigest()


def restore_previous_catalog(db, manifest=None):
    if db.get(StoreSnapshot, MARKER):
        return
    archive = db.get(StoreSnapshot, ARCHIVE_SNAPSHOT)
    photos = db.get(StoreSnapshot, PHOTO_SNAPSHOT)
    if not archive and not photos:
        return
    if manifest is None:
        manifest = json.loads((Path(__file__).resolve().parents[1] / 'data' / 'source_cleanup_undo.json').read_text())
    archived = json.loads(gzip.decompress(archive.payload))['products'] if archive else []
    photo_before = json.loads(gzip.decompress(photos.payload)) if photos else []
    archived = {p['id']: p for p in archived}
    photo_before = {p['id']: p for p in photo_before}
    applied_photos = {p['id']: p for p in manifest['photo_repairs']}
    ids = sorted(archived.keys() | photo_before.keys())
    rows = db.scalars(select(Product).where(Product.id.in_(ids)).order_by(Product.id).with_for_update()).unique().all()
    if db.get(StoreSnapshot, MARKER):
        return
    result = {'format': manifest['format'], 'restored_products': [], 'restored_photos': [],
              'preserved_later_edits': [], 'before': []}
    for product in rows:
        before = {'id': product.id, 'active': product.active, 'sale_enabled': product.sale_enabled,
                  'image': product.image, 'metadata': product.metadata_json, 'version': product.version}
        changed = False
        if product.id in archived:
            old = archived[product.id]
            record = product_view(product)
            record['active'], record['sale_enabled'] = old['active'], old['sale_enabled']
            expected = manifest['archived_products'].get(product.id)
            if not product.active and not product.sale_enabled and fingerprint(record) == expected:
                product.active, product.sale_enabled = old['active'], old['sale_enabled']
                result['restored_products'].append(product.id)
                changed = True
            else:
                result['preserved_later_edits'].append(product.id)
        if product.id in photo_before and product.id in applied_photos:
            old, applied = photo_before[product.id], applied_photos[product.id]
            expected = {'galleryImages': applied['gallery'], 'images': applied['gallery'],
                        'image_source': applied['source'], 'image_source_title': applied['source_title'],
                        'image_reference': False}
            if product.image == applied['image'] and all(product.metadata_json.get(k) == v for k, v in expected.items()):
                metadata = dict(product.metadata_json)
                for key in PHOTO_KEYS:
                    if key in old['metadata']:
                        metadata[key] = old['metadata'][key]
                    else:
                        metadata.pop(key, None)
                product.image, product.metadata_json = old['image'], metadata
                result['restored_photos'].append(product.id)
                changed = True
            else:
                result['preserved_later_edits'].append(product.id)
        if changed:
            # Keep current stock, prices, and monotonic optimistic-lock versions.
            product.version += 1
            result['before'].append(before)
    db.add(StoreSnapshot(id=MARKER, payload=gzip.compress(json.dumps(result).encode())))
    if result['before']:
        touch_catalog(db)
