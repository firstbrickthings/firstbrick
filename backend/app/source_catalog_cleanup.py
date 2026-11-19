"""Archive the owner's unapproved catalogue samples without deleting stock or history."""
import gzip
import hashlib
import json
from pathlib import Path

from sqlalchemy import select

from .models import Product, StoreSnapshot
from .services import product_view, touch_catalog

MARKER = 'catalogue:approved-sources-only-v1'
PHOTO_MARKER = 'storefront:linked-source-photo-repairs-v1'
LINKED_CATALOGUES = ('babyone-cetaphil-', 'babyone-sebamed-', 'babyone-diapers-',
                     'babyone-bath-', 'bo-bath-filter-', 'bo-verified-')


def approved_product(record):
    return bool(record['metadata'].get('owner_photo_import')) or record['id'].startswith(LINKED_CATALOGUES)


def fingerprint(record):
    # Stock and version may change during checkout; descriptive/price edits are protected.
    data = {key: value for key, value in record.items() if key != 'version'}
    data['variants'] = [{key: value for key, value in variant.items() if key != 'stock'}
                        for variant in record['variants']]
    return hashlib.sha256(json.dumps(data, sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode()).hexdigest()


def retire_unapproved_catalog(db, manifest=None):
    if db.get(StoreSnapshot, MARKER):
        return
    if manifest is None:
        manifest = json.loads((Path(__file__).resolve().parents[1] / 'data' / 'source_catalog_cleanup.json').read_text())
    targets = {entry['id']: entry for entry in manifest['targets']}
    rows = db.scalars(select(Product).where(Product.id.in_(targets)).order_by(Product.id).with_for_update()).unique().all()
    if db.get(StoreSnapshot, MARKER):
        return
    before = {'format': manifest['format'], 'products': [], 'preserved_intervening_edits': []}
    for product in rows:
        record = product_view(product)
        if approved_product(record) or fingerprint(record) != targets[product.id]['expected_fingerprint']:
            before['preserved_intervening_edits'].append(product.id)
            continue
        before['products'].append({'id': product.id, 'active': product.active,
                                   'sale_enabled': product.sale_enabled, 'version': product.version})
        if product.active or product.sale_enabled:
            product.active = product.sale_enabled = False
            product.version += 1
    db.add(StoreSnapshot(id=MARKER, payload=gzip.compress(json.dumps(before).encode())))
    if before['products']:
        touch_catalog(db)


def repair_linked_source_photos(db, repairs=None):
    if db.get(StoreSnapshot, PHOTO_MARKER):
        return
    if repairs is None:
        repairs = json.loads((Path(__file__).resolve().parents[1] / 'data' / 'source_photo_repairs.json').read_text())
    targets = {entry['id']: entry for entry in repairs}
    rows = db.scalars(select(Product).where(Product.id.in_(targets)).order_by(Product.id).with_for_update()).unique().all()
    if db.get(StoreSnapshot, PHOTO_MARKER):
        return
    before = []
    for product in rows:
        entry = targets[product.id]
        if product.image != entry['expected_image'] or product.metadata_json.get('owner_photo_import'):
            continue
        before.append({'id': product.id, 'image': product.image, 'metadata': product.metadata_json, 'version': product.version})
        product.image = entry['image']
        product.metadata_json = {**product.metadata_json, 'galleryImages': entry['gallery'], 'images': entry['gallery'],
                                 'image_source': entry['source'], 'image_source_title': entry['source_title'], 'image_reference': False}
        product.version += 1
    db.add(StoreSnapshot(id=PHOTO_MARKER, payload=gzip.compress(json.dumps(before).encode())))
    if before:
        touch_catalog(db)
