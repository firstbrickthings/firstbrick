"""One-time import of the owner's fashion photographs and confirmed size labels."""
import gzip
import json
from copy import deepcopy
from pathlib import Path

from sqlalchemy import select

from .models import StoreDocument, StoreSnapshot
from .owner_photo_catalog import apply_owner_photo_catalog
from .services import touch_catalog

MARKER = 'catalogue:owner-fashion-9d708208-v1'
MENU_MARKER = 'storefront:owner-fashion-style-menu-v1'
STYLE_CATEGORIES = ['Onesies & Rompers', 'Dresses & Frocks', 'Outfit Sets', 'Shorts & Bottoms']


def apply_owner_fashion_catalog(db, manifest=None):
    if db.get(StoreSnapshot, MARKER):
        return
    if manifest is None:
        manifest = json.loads((Path(__file__).resolve().parents[1] / 'data' / 'owner_fashion_catalog.json').read_text())
    for entry in manifest['products']:
        if entry['category'] != 'Clothing' or entry.get('option_type') != 'size':
            raise ValueError('Fashion imports require clothing with confirmed size options.')
        if [v['label'] for v in entry['options']] != ['S', 'M', 'L', 'XL']:
            raise ValueError('Use the four size labels confirmed by the owner.')
        if entry['clothing'].get('age_range') is not None:
            raise ValueError('An age conversion has not been supplied for these garments.')
    apply_owner_photo_catalog(db, manifest, marker=MARKER)


def complete_fashion_menu(db):
    if db.get(StoreSnapshot, MENU_MARKER):
        return
    document = db.scalar(select(StoreDocument).where(StoreDocument.key == 'categories').with_for_update())
    if not document or db.get(StoreSnapshot, MENU_MARKER):
        return
    before = {'value': deepcopy(document.value), 'version': document.version}
    items = deepcopy(document.value.get('items', []))
    clothing = next((c for c in items if c.get('name') == 'Clothing'), None)
    if not clothing:
        return
    clothing['subcategories'] = STYLE_CATEGORIES + [s for s in clothing.get('subcategories', []) if s not in STYLE_CATEGORIES]
    if items != document.value.get('items', []):
        document.value = {**document.value, 'items': items}
        document.version += 1
        touch_catalog(db)
    db.add(StoreSnapshot(id=MENU_MARKER, payload=gzip.compress(json.dumps(before).encode())))
