"""The owner's one-time ₹1 catalogue payment check. Never reset later edits."""
from sqlalchemy import select
from .models import Category, Product, StoreDocument, Variant

PRODUCT_ID = 'babyone-hospital-bag-payment-check'
VARIANT_ID = '48de40b9-bd37-4e1a-8c5a-741ea934cff9'
MARKER = 'setup:one-rupee-check-v1'


def is_live_check(product):
    return product.id == PRODUCT_ID and product.metadata_json.get('live_gateway_check') is True


def configure(db):
    if db.get(StoreDocument, MARKER):
        return
    if db.get(Product, PRODUCT_ID):
        raise RuntimeError('The requested live-check product ID is already in use.')
    category = db.scalar(select(Category).where(Category.name == 'New Born'))
    if not category:
        category = Category(id='new-born', name='New Born', delivery_fee=50)
        db.add(category)
        db.flush()
    db.add(Product(id=PRODUCT_ID, name='Hospital Bag · ₹1 Payment Check', category_id=category.id,
                   description='A one-time ₹1 LIVE payment check with ₹0 delivery. Real money is charged. '
                               'This listing checks the payment connection; no physical hospital bag is supplied. '
                               'Buy this item on its own, quantity 1.',
                   image='assets/hospital-bag-payment-check.svg', active=True, sale_enabled=True,
                   metadata_json={'subcategory':'Hospital Bags', 'badge':'₹1 LIVE PAYMENT CHECK',
                                  'live_gateway_check':True, 'galleryImages':['assets/hospital-bag-payment-check.svg']}))
    db.flush()
    db.add(Variant(id=VARIANT_ID, product_id=PRODUCT_ID, label='Payment check only', price='1.00', stock=5))
    categories = db.get(StoreDocument, 'categories')
    if categories:
        value = {**categories.value, 'items':[dict(item) for item in categories.value.get('items', [])]}
        item = next((item for item in value['items'] if item.get('name') == 'New Born'), None)
        if item and 'Hospital Bags' not in item.get('subcategories', []):
            item['subcategories'] = [*item.get('subcategories', []), 'Hospital Bags']
            categories.value = value
            categories.version += 1
    db.add(StoreDocument(key=MARKER, value={'product_id':PRODUCT_ID}, version=1))
    from .services import touch_catalog
    touch_catalog(db)
