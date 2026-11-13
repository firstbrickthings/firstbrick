"""Import catalogue drafts, then apply explicitly requested one-time owner setup."""
import json
from decimal import Decimal, InvalidOperation
from pathlib import Path
from uuid import uuid4
from sqlalchemy import select
from .db import sessions
from .models import Category, Product, Variant
from .test_catalog import configure_test_product

RATES = {'New Born': 50, 'Feeding': 60, 'Diapering': 60, 'Clothing': 50, 'Fashion': 50,
         'Toys & Learning': 80, 'Hospital Kit': 80, 'Nursery & Furniture': 150,
         'Cradles & Rockers': 150, 'Bath & Skincare': 50, 'Travel & Gear': 150, 'Mom Care': 50}


def price(value, currency):
    try:
        result = Decimal(str(value or 0))
        if not result.is_finite() or result < 0:
            return Decimal('0.00')
        # Preserve the original frontend's display conversion; all values still need approval.
        if currency != 'INR':
            result = (result * Decimal('83.5')).quantize(Decimal('1'))
        return min(result, Decimal('9999999')).quantize(Decimal('0.01'))
    except (InvalidOperation, ValueError):
        return Decimal('0.00')


def run():
    path = Path(__file__).resolve().parents[1] / 'data' / 'catalog.json'
    source = json.loads(path.read_text())
    with sessions()() as db:
        existing = set(db.scalars(select(Product.id)))
        category_names = set(db.scalars(select(Category.name)))
        category_map = {c.name: c.id for c in db.scalars(select(Category))}
        for name in sorted({p.get('category') or 'Other' for p in source}):
            if name not in category_names:
                category_id = str(uuid4())
                db.add(Category(id=category_id, name=name[:100], delivery_fee=RATES.get(name, 60)))
                category_map[name] = category_id
        db.flush()
        added = 0
        for item in source:
            if item['id'] in existing:
                continue
            metadata = {key: item[key] for key in ['brand', 'subcategory', 'badge', 'galleryImages', 'images', 'patterns'] if key in item}
            metadata['imported_price_requires_confirmation'] = True
            product = Product(id=item['id'], name=item['name'][:255], category_id=category_map[item.get('category') or 'Other'],
                              description=item.get('description') or '', image=item.get('image') or '',
                              active=not item.get('catalogHidden', False), sale_enabled=False, metadata_json=metadata)
            db.add(product)
            options = item.get('variants') or [{'size': '', 'price': item.get('price')}]
            for position, option in enumerate(options):
                db.add(Variant(id=str(uuid4()), product_id=item['id'], label=str(option.get('size') or '')[:191],
                               position=position, price=price(option.get('price', item.get('price')), item.get('currency')),
                               stock=0, enabled=option.get('available', True) is not False))
            added += 1
            existing.add(item['id'])
        db.flush()
        configure_test_product(db)
        db.commit()
        from .catalog_setup import apply_requested_setup
        apply_requested_setup(db)
        from .shipping_setup import apply_flat_delivery
        apply_flat_delivery(db)
        from .shipping_setup import apply_shipping_policy
        apply_shipping_policy(db)
    print(f'Imported {added} new products. Owner catalogue changes are logged separately.')


if __name__ == '__main__':
    run()
