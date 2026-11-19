"""Import the six owner photo archives and complete their public menu entries once."""
import gzip
import json
from copy import deepcopy
from pathlib import Path

from sqlalchemy import select

from .models import Category, Product, StoreDocument, StoreSnapshot
from .owner_photo_catalog import apply_owner_photo_catalog
from .services import touch_catalog

MARKER = 'catalogue:owner-toys-20261117-v1'
MENU_MARKER = 'storefront:owner-toys-potty-menu-v1'


def apply_owner_toy_catalog(db, manifest=None):
    if db.get(StoreSnapshot, MARKER):
        return
    if manifest is None:
        manifest = json.loads((Path(__file__).resolve().parents[1] / 'data' / 'owner_toy_catalog.json').read_text())
    apply_owner_photo_catalog(db, manifest, marker=MARKER)


def complete_owner_catalog_menu(db):
    if db.get(StoreSnapshot, MENU_MARKER):
        return
    document = db.scalar(select(StoreDocument).where(StoreDocument.key == 'categories').with_for_update())
    if not document or db.get(StoreSnapshot, MENU_MARKER):
        return
    before = {'value': deepcopy(document.value), 'version': document.version}
    items = deepcopy(document.value.get('items', []))
    categories = {c.name: c for c in db.scalars(select(Category))}
    products = db.scalars(select(Product).where(Product.active.is_(True))).unique().all()
    by_name = {c['name']: c for c in items}
    potty = categories.get('Potty')
    potty_products = [p for p in products if potty and p.category_id == potty.id]
    if potty_products and 'Potty' not in by_name:
        cover = next((p.image for p in potty_products if p.id == 'bo-photo-3bc4-007'), potty_products[0].image)
        items.append({'id': potty.id, 'name': 'Potty', 'img': cover,
                      'subcategories': ['Potty Set', 'Ladder Potty', 'Potty Training Set']})
    for name, subcategory in [('Toys & Learning', 'Musical Toys'), ('Clothing', 'Kids Bags')]:
        category = by_name.get(name)
        if category and subcategory not in category.get('subcategories', []):
            category['subcategories'] = [*category.get('subcategories', []), subcategory]
    if items != document.value.get('items', []):
        document.value = {**document.value, 'items': items}
        document.version += 1
        touch_catalog(db)
    db.add(StoreSnapshot(id=MENU_MARKER, payload=gzip.compress(json.dumps(before).encode())))
