"""Archive the owner's completed storefront payment checks without deleting history."""
import gzip
import json
from pathlib import Path
from sqlalchemy import select
from .models import Product, StoreDocument, StoreSnapshot

MARKER = 'catalogue:retire-payment-listings-v1'
PAYMENT_CATEGORY_ID = 'babyone-payment-testing'
CHECKS = {
    'babyone-payment-test': 'payment_test',
    'babyone-hospital-bag-payment-check': 'live_gateway_check',
}


def retire_payment_listings(db):
    if db.get(StoreSnapshot, MARKER):
        return
    records = db.scalars(select(Product).where(Product.id.in_(CHECKS)).order_by(Product.id).with_for_update()).unique().all()
    products = [p for p in records if p.metadata_json.get(CHECKS[p.id]) is True]
    document = db.get(StoreDocument, 'categories')
    before = {'format': 'babyone-catalogue-retirement-v1',
              'products': [{'id': p.id, 'active': p.active, 'sale_enabled': p.sale_enabled, 'version': p.version} for p in products],
              'categories': {'value': document.value, 'version': document.version} if document else None}
    changed = False
    for product in products:
        if product.active or product.sale_enabled:
            product.active = product.sale_enabled = False
            product.version += 1
            changed = True
    db.flush()
    # Retain the category row for historical references. Keep it visible if it has real stock listings.
    has_active_products = db.scalar(select(Product.id).where(Product.category_id == PAYMENT_CATEGORY_ID, Product.active.is_(True)).limit(1))
    if document and not has_active_products:
        items = document.value.get('items', [])
        retained = [item for item in items if item.get('id') != PAYMENT_CATEGORY_ID]
        if retained != items:
            document.value = {**document.value, 'items': retained}
            document.version += 1
            changed = True
    db.add(StoreSnapshot(id=MARKER, payload=gzip.compress(json.dumps(before).encode())))
    if changed:
        from .services import touch_catalog
        touch_catalog(db)


RIDEON_MARKER = 'catalogue:rideon-real-products-only-v1'


def retire_rideon_templates(db, targets=None):
    """Archive sample listings while preserving inventory, order history and later owner edits."""
    if db.get(StoreSnapshot, RIDEON_MARKER):
        return
    if targets is None:
        targets = json.loads((Path(__file__).resolve().parents[1] / 'data' / 'rideon_template_retirement.json').read_text())
    expected = {item['id']: item for item in targets}
    products = db.scalars(select(Product).where(Product.id.in_(expected)).order_by(Product.id).with_for_update()).unique().all()
    if db.get(StoreSnapshot, RIDEON_MARKER):
        return
    before = {'format': 'babyone-rideon-template-archive-v1', 'products': [], 'preserved_intervening_edits': []}
    changed = False
    for product in products:
        original = expected[product.id]
        if (product.category.name != 'Ride-On' or product.metadata_json.get('owner_photo_import')
                or product.name != original['name'] or product.image != original['expected_image']):
            before['preserved_intervening_edits'].append(product.id)
            continue
        before['products'].append({'id': product.id, 'active': product.active,
                                   'sale_enabled': product.sale_enabled, 'version': product.version})
        if product.active or product.sale_enabled:
            product.active = product.sale_enabled = False
            product.version += 1
            changed = True
    db.add(StoreSnapshot(id=RIDEON_MARKER, payload=gzip.compress(json.dumps(before).encode())))
    if changed:
        from .services import touch_catalog
        touch_catalog(db)
