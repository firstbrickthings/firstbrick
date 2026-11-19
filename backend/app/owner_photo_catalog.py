"""Import the owner's grouped product photographs once without rewriting existing listings."""
import gzip
import json
from decimal import Decimal
from pathlib import Path
from uuid import NAMESPACE_URL, uuid5

from sqlalchemy import select

from .models import Category, Product, StoreSnapshot, Variant
from .services import touch_catalog

MARKER = 'catalogue:owner-photos-3bc48208-v1'


def apply_owner_photo_catalog(db, manifest=None):
    if db.get(StoreSnapshot, MARKER):
        return
    if manifest is None:
        manifest = json.loads((Path(__file__).resolve().parents[1] / 'data' / 'owner_photo_catalog.json').read_text())
    entries = manifest['products']
    names = {entry['category'] for entry in entries}
    # Existing category rows also serialize concurrent imports of this same batch.
    categories = db.scalars(select(Category).where(Category.name.in_(names)).order_by(Category.id).with_for_update()).all()
    category_ids = {category.name: category.id for category in categories}
    if db.get(StoreSnapshot, MARKER):
        return
    missing = names - category_ids.keys()
    if missing:
        raise ValueError('Owner photo import needs existing categories: ' + ', '.join(sorted(missing)))
    ids = [entry['id'] for entry in entries]
    if len(ids) != len(set(ids)):
        raise ValueError('Duplicate product ID in the owner photo import.')
    for entry in entries:
        if not entry['gallery'] or entry['image'] != entry['gallery'][0]:
            raise ValueError('Each product needs its own main photograph at the start of its gallery.')
        if sum(option['stock'] for option in entry['options']) != 10:
            raise ValueError('Each imported product must have ten units in total.')
        if any(Decimal(option['price']) < Decimal('1099') for option in entry['options']):
            raise ValueError('The owner requested prices from INR 1099 upward.')
    existing = set(db.scalars(select(Product.id).where(Product.id.in_(ids))))
    created = []
    for entry in entries:
        if entry['id'] in existing:
            continue
        variant_images = {option['label']: option['images'] for option in entry['options'] if option.get('images')}
        metadata = {
            'subcategory': entry['subcategory'], 'brand': entry['brand'], 'badge': 'New Arrival',
            'galleryImages': entry['gallery'], 'images': entry['gallery'], 'image_reference': False,
            'owner_photo_import': manifest['batch_id'], 'photo_source_indices': entry['source_indices'],
            'unit': entry['unit'], 'option_type': 'colour' if variant_images else 'pack',
            'variant_images': variant_images, 'price_source': 'owner_requested_provisional',
            'logistics': {'tier': entry['logistics_tier']},
        }
        product = Product(id=entry['id'], name=entry['name'], category_id=category_ids[entry['category']],
                          description=entry['description'], image=entry['image'], active=True,
                          sale_enabled=True, metadata_json=metadata)
        db.add(product)
        db.flush()
        for position, option in enumerate(entry['options']):
            variant_id = str(uuid5(NAMESPACE_URL, f"babyone:{MARKER}:{entry['id']}:{option['label']}"))
            db.add(Variant(id=variant_id, product_id=product.id, label=option['label'], position=position,
                           price=Decimal(option['price']), stock=option['stock'], enabled=True))
        created.append(product.id)
    snapshot = {'format': 'babyone-owner-photo-import-v1', 'batch_id': manifest['batch_id'],
                'source_sha256': manifest['source_sha256'], 'created_product_ids': created,
                'existing_products_preserved': sorted(existing)}
    db.add(StoreSnapshot(id=MARKER, payload=gzip.compress(json.dumps(snapshot).encode())))
    if created:
        touch_catalog(db)
