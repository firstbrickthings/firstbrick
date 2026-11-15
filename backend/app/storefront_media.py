"""Apply the owner's requested reference photos once, retaining a private undo snapshot."""
import gzip
import json
from pathlib import Path
from sqlalchemy import select
from .models import Product, StoreDocument, StoreSnapshot
from .services import touch_catalog

MARKER = 'storefront:product-and-banner-photos-v1'
PROFILE_MARKER = 'storefront:category-profile-photos-v1'


def apply_storefront_media(db, manifest=None):
    if db.get(StoreSnapshot, MARKER):
        return
    if manifest is None:
        manifest = json.loads((Path(__file__).resolve().parents[1] / 'data' / 'storefront_media.json').read_text())
    entries = {p['id']: p for p in manifest['products']}
    products = db.scalars(select(Product).where(Product.id.in_(entries)).order_by(Product.id).with_for_update()).unique().all()
    if db.get(StoreSnapshot, MARKER):
        return
    before = {'products': [], 'documents': {}}
    changed = False
    for product in products:
        entry = entries[product.id]
        # A matching old image and name protect intervening edits, especially owner uploads.
        if not product.active or product.image != entry['expected_image'] or product.name != entry['name']:
            continue
        before['products'].append({'id': product.id, 'image': product.image, 'metadata': product.metadata_json, 'version': product.version})
        product.image = entry['image']
        product.metadata_json = {**product.metadata_json, 'galleryImages': entry['gallery'], 'images': entry['gallery'],
                                 'image_reference': entry['reference'], 'image_source': entry['source'],
                                 'image_source_title': entry['source_title']}
        product.version += 1
        changed = True
    for key in ['banners', 'fashion', 'categories']:
        document = db.scalar(select(StoreDocument).where(StoreDocument.key == key).with_for_update())
        before['documents'][key] = {'value': document.value, 'version': document.version} if document else None
        if document is None:
            items = manifest['categories'] if key == 'categories' else [item for item in manifest['banners'] if item['id'].startswith('fashion-' if key == 'fashion' else ('promo1-', 'promo2-'))]
            db.add(StoreDocument(key=key, value={'items': items}, version=1))
            changed = True
        elif key == 'categories':
            covers = {c['id']: c for c in manifest['category_updates']}
            items = []
            for item in document.value.get('items', []):
                cover = covers.get(item.get('id'))
                items.append({**item, 'img': cover['image']} if cover and item.get('img') == cover['expected_image'] else item)
            if items != document.value.get('items'):
                document.value = {**document.value, 'items': items}
                document.version += 1
                changed = True
        # Existing uploaded banners, videos, order/payment data and inventory remain untouched.
    db.add(StoreSnapshot(id=MARKER, payload=gzip.compress(json.dumps(before).encode())))
    if changed:
        touch_catalog(db)


def apply_category_profiles(db, profiles=None):
    """Replace the previous default covers once, preserving later owner uploads and navigation."""
    if db.get(StoreSnapshot, PROFILE_MARKER):
        return
    document = db.scalar(select(StoreDocument).where(StoreDocument.key == 'categories').with_for_update())
    if not document or db.get(StoreSnapshot, PROFILE_MARKER):
        return
    if profiles is None:
        profiles = json.loads((Path(__file__).resolve().parents[1] / 'data' / 'category_profiles.json').read_text())
    covers = {p['id']: p for p in profiles}
    before = {'value': document.value, 'version': document.version}
    items = []
    for item in document.value.get('items', []):
        cover = covers.get(item.get('id'))
        items.append({**item, 'img': cover['image']} if cover and item.get('img') == cover['expected_image'] else item)
    db.add(StoreSnapshot(id=PROFILE_MARKER, payload=gzip.compress(json.dumps(before).encode())))
    if items != document.value.get('items'):
        document.value = {**document.value, 'items': items}
        document.version += 1
        touch_catalog(db)
