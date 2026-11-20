"""One-time correction of misplaced diapers; retain all commerce data."""
import gzip
import json
from sqlalchemy import select
from .models import Category, Product, StoreDocument, StoreSnapshot
from .services import touch_catalog

MARKER = 'catalogue:diapers-in-diapering-v1'


def apply_diaper_category_fix(db):
    if db.get(StoreSnapshot, MARKER):
        return
    bath = db.scalar(select(Category).where(Category.name == 'Bath & Skincare'))
    diapering = db.scalar(select(Category).where(Category.name == 'Diapering'))
    if not bath or not diapering:
        return
    before = []
    for product in db.scalars(select(Product).where(Product.category_id == bath.id).with_for_update()).unique():
        if product.metadata_json.get('subcategory') == 'Diapers':
            before.append({'id': product.id, 'category_id': product.category_id, 'version': product.version})
            product.category_id = diapering.id
            product.version += 1
    doc = db.get(StoreDocument, 'categories')
    old_menu = doc.value if doc else None
    if doc:
        value = json.loads(json.dumps(doc.value))
        for item in value['items']:
            if item.get('name') == 'Bath & Skincare':
                item['subcategories'] = [s for s in item.get('subcategories', []) if s != 'Diapers']
            if item.get('name') == 'Diapering' and 'Diapers' not in item.get('subcategories', []):
                item.setdefault('subcategories', []).append('Diapers')
        if value != doc.value:
            doc.value = value
            doc.version += 1
    db.add(StoreSnapshot(id=MARKER, payload=gzip.compress(json.dumps({'products': before, 'categories': old_menu}).encode())))
    if before:
        touch_catalog(db)
