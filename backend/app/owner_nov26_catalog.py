"""Import reviewed photographs and simplify the clothing menu once."""
import gzip
import json
from pathlib import Path
from sqlalchemy import select
from .models import Product, StoreDocument, StoreSnapshot
from .owner_photo_catalog import apply_owner_photo_catalog
from .services import touch_catalog

MARKER = 'catalogue:owner-new-products-20261126-v1'
MENU_MARKER = 'storefront:fashion-collections-20261126-v1'
COLLECTIONS = ['Dresses & Outfits', 'Baby Girl', 'Baby Boy', 'Newborn Essentials', 'Accessories', 'New Arrivals']


def apply_owner_nov26_catalog(db, manifest=None):
    if db.get(StoreSnapshot, MENU_MARKER):
        return
    if manifest is None:
        manifest = json.loads((Path(__file__).resolve().parents[1] / 'data' / 'owner_nov26_catalog.json').read_text())
    apply_owner_photo_catalog(db, manifest, marker=MARKER)
    before = {'galleries': [], 'categories': None}
    for update in manifest.get('gallery_updates', []):
        product = db.get(Product, update['id'])
        if not product:
            raise RuntimeError('The existing bathtub listing is missing; review before adding its photos.')
        before['galleries'].append({'id': product.id, 'metadata': product.metadata_json, 'version': product.version})
        metadata = dict(product.metadata_json)
        gallery = list(dict.fromkeys([product.image, *metadata.get('galleryImages', []), *update['gallery']]))
        metadata.update(galleryImages=gallery, images=gallery)
        product.metadata_json = metadata
        product.version += 1
    document = db.scalar(select(StoreDocument).where(StoreDocument.key == 'categories').with_for_update())
    if document:
        before['categories'] = {'value': document.value, 'version': document.version}
        value = json.loads(json.dumps(document.value))
        for item in value['items']:
            if item.get('name') == 'Clothing':
                item['subcategories'] = COLLECTIONS[:]
            else:
                additions = [p['subcategory'] for p in manifest['products'] if p['category'] == item.get('name')]
                item['subcategories'] = list(dict.fromkeys([*item.get('subcategories', []), *additions]))
        document.value = value
        document.version += 1
    db.add(StoreSnapshot(id=MENU_MARKER, payload=gzip.compress(json.dumps(before).encode())))
    touch_catalog(db)
