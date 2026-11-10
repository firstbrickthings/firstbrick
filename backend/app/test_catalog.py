"""One explicitly enabled payment-test item; imported inventory stays unapproved."""
from .config import settings
from .models import Category, Product, Variant

PRODUCT_ID = 'babyone-payment-test'
VARIANT_ID = '86ee10f8-2e45-4b61-b174-a26be7b207c4'
CATEGORY_ID = 'babyone-payment-testing'


def configure_test_product(db):
    product = db.get(Product, PRODUCT_ID)
    enabled = settings().test_checkout_enabled
    if product:
        if not product.metadata_json.get('payment_test'):
            raise RuntimeError('Payment-test product ID is already in use.')
        if product.active != enabled or product.sale_enabled != enabled:
            product.active = product.sale_enabled = enabled
            product.version += 1
        # Never replenish inventory or overwrite an existing price on a restart.
        return
    if not enabled:
        return
    if not db.get(Category, CATEGORY_ID):
        db.add(Category(id=CATEGORY_ID, name='Payment Testing', delivery_fee='0.00'))
        db.flush()
    db.add(Product(id=PRODUCT_ID, name='Razorpay Test Product', category_id=CATEGORY_ID,
                   description='Payment test only. No physical product will be delivered. '
                               'Pay ₹10 in Razorpay Test Mode; no real money is charged.',
                   image='/assets/payment-test.svg', active=True, sale_enabled=True,
                   metadata_json={'payment_test': True, 'badge': 'TEST PAYMENT · NO REAL CHARGE'}))
    db.flush()
    db.add(Variant(id=VARIANT_ID, product_id=PRODUCT_ID, label='Test only',
                   price='10.00', stock=1000, enabled=True))
