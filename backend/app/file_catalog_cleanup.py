"""Archive the reviewed legacy listings once, retaining uploads and every menu."""
import gzip
import json
from pathlib import Path
from sqlalchemy import select
from .models import Product, StoreSnapshot
from .services import touch_catalog

MARKER = 'catalogue:uploaded-files-and-bath-only-v1'


def is_uploaded(product):
    metadata = product.metadata_json or {}
    if metadata.get('owner_photo_import'):
        return True
    photos = [product.image]
    for key in ('galleryImages', 'images'):
        if isinstance(metadata.get(key), list):
            photos.extend(metadata[key])
    return any(isinstance(photo, str) and photo.startswith((
        '/api/media/', 'assets/owner-products/', 'assets/owner-toys/', 'assets/owner-fashion/'
    )) for photo in photos)


def archive_reviewed_legacy_products(db, targets=None):
    if db.get(StoreSnapshot, MARKER):
        return
    if targets is None:
        targets = json.loads((Path(__file__).resolve().parents[1] / 'data' / 'file_catalog_cleanup.json').read_text())['archive_ids']
    rows = db.scalars(select(Product).where(Product.id.in_(targets)).order_by(Product.id).with_for_update()).unique().all()
    if db.get(StoreSnapshot, MARKER):
        return
    before, preserved = [], []
    for product in rows:
        # Retain a listing moved to skincare or supplied with real photos since review.
        if product.category.name == 'Bath & Skincare' or is_uploaded(product):
            preserved.append(product.id)
            continue
        if product.active or product.sale_enabled:
            before.append({'id': product.id, 'active': product.active,
                           'sale_enabled': product.sale_enabled, 'version': product.version})
            product.active = product.sale_enabled = False
            product.version += 1
    db.add(StoreSnapshot(id=MARKER, payload=gzip.compress(json.dumps({
        'products': before, 'preserved_later_uploads': preserved,
        'policy': 'Uploaded files plus Bath & Skincare; categories unchanged'
    }).encode())))
    if before:
        touch_catalog(db)
