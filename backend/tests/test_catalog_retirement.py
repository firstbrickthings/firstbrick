import gzip
import json
from sqlalchemy import func, select
from app.catalog_retirement import MARKER, PAYMENT_CATEGORY_ID, retire_payment_listings
from app.config import settings
from app.db import sessions
from app.live_check_catalog import configure as configure_live, PRODUCT_ID as LIVE_ID, VARIANT_ID as LIVE_VARIANT
from app.models import Category, Order, Payment, Product, StoreDocument, StoreSnapshot, Variant
from app.test_catalog import configure_test_product, PRODUCT_ID as TEST_ID, VARIANT_ID as TEST_VARIANT
from conftest import headers
from test_payments import gateway, start, callback


def test_retirement_archives_checks_and_keeps_paid_history_and_inventory(client, gateway, monkeypatch):
    monkeypatch.setattr(settings(), 'enable_test_checkout', True)
    with sessions()() as db:
        configure_test_product(db)
        configure_live(db)
        db.add(StoreDocument(key='categories', value={'items': [
            {'id': PAYMENT_CATEGORY_ID, 'name': 'Payment Testing', 'subcategories': []},
            {'id': 'feeding', 'name': 'Feeding', 'subcategories': ['Bottles']}]}, version=7))
        db.commit()
    order, checkout = start(client, gateway)
    confirmed = client.post('/api/payments/razorpay/' + order['id'] + '/verify', json=callback(gateway, checkout), headers=headers())
    assert confirmed.json()['payment_status'] == 'paid'
    with sessions()() as db:
        inventory = [(v.id, str(v.price), v.stock, v.enabled) for v in db.scalars(select(Variant).order_by(Variant.id))]
        history = [(o.id, o.items, str(o.total), o.status) for o in db.scalars(select(Order))]
        payments = [(p.order_id, p.provider_payment_id, p.amount_paise, p.status, p.mode) for p in db.scalars(select(Payment))]
        retire_payment_listings(db)
        db.commit()
        saved = json.loads(gzip.decompress(db.get(StoreSnapshot, MARKER).payload))
        assert {p['id'] for p in saved['products']} == {LIVE_ID, TEST_ID}
        assert all(p['active'] for p in saved['products'])
        assert saved['categories']['version'] == 7
        assert db.get(StoreDocument, 'categories').version == 8
        assert [i['id'] for i in db.get(StoreDocument, 'categories').value['items']] == ['feeding']
        assert inventory == [(v.id, str(v.price), v.stock, v.enabled) for v in db.scalars(select(Variant).order_by(Variant.id))]
        assert history == [(o.id, o.items, str(o.total), o.status) for o in db.scalars(select(Order))]
        assert payments == [(p.order_id, p.provider_payment_id, p.amount_paise, p.status, p.mode) for p in db.scalars(select(Payment))]
        versions = {pid: db.get(Product, pid).version for pid in [LIVE_ID, TEST_ID]}
        # Restart setup must not revive either checkout listing or reset any stock.
        configure_test_product(db)
        configure_live(db)
        retire_payment_listings(db)
        db.commit()
        assert versions == {pid: db.get(Product, pid).version for pid in versions}
        assert db.scalar(select(func.count()).select_from(StoreSnapshot)) == 1
    assert {p['id'] for p in client.get('/api/catalog/products').json()['items']} == {'bottle'}
    assert PAYMENT_CATEGORY_ID not in {c['id'] for c in client.get('/api/catalog/categories').json()}
    for product_id, variant in [(LIVE_ID, LIVE_VARIANT), (TEST_ID, TEST_VARIANT)]:
        assert client.get('/api/catalog/products/' + product_id).status_code == 404
        assert client.post('/api/checkout/quote', json={'items': [{'variant_id': variant, 'quantity': 1}]}, headers=headers()).status_code == 409
    owner = client.get('/api/admin/products', headers=headers('owner')).json()['items']
    assert {p['id'] for p in owner} == {'bottle', LIVE_ID, TEST_ID}
    assert all(not p['active'] and not p['sale_enabled'] for p in owner if p['id'] != 'bottle')
    assert client.get('/api/me/orders/' + order['id'], headers=headers()).json()['payment_status'] == 'paid'


def test_new_install_does_not_create_completed_payment_checks(monkeypatch):
    monkeypatch.setattr(settings(), 'enable_test_checkout', True)
    with sessions()() as db:
        retire_payment_listings(db)
        db.commit()
        configure_test_product(db)
        configure_live(db)
        db.commit()
        assert db.get(Product, LIVE_ID) is None and db.get(Product, TEST_ID) is None
        assert db.get(Product, 'bottle').active and db.get(Product, 'bottle').sale_enabled


def test_a_real_listing_in_the_former_test_category_is_kept(client):
    with sessions()() as db:
        db.add(Category(id=PAYMENT_CATEGORY_ID, name='Payment Testing'))
        db.flush()
        db.add(Product(id='real-product', category_id=PAYMENT_CATEGORY_ID, name='Real store product', active=True))
        db.add(StoreDocument(key='categories', value={'items': [{'id': PAYMENT_CATEGORY_ID, 'name': 'Payment Testing', 'subcategories': []}]}, version=1))
        db.commit()
        retire_payment_listings(db)
        db.commit()
        assert db.get(Product, 'real-product').active
        assert db.get(StoreDocument, 'categories').version == 1
    assert PAYMENT_CATEGORY_ID in {c['id'] for c in client.get('/api/catalog/categories').json()}
