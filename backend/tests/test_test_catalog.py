from decimal import Decimal
from sqlalchemy import func, select
from app.config import settings
from app.db import sessions
from app.models import Order, Product, Variant
from app.test_catalog import configure_test_product, PRODUCT_ID, VARIANT_ID
from conftest import headers
from test_store import payload


def enable(monkeypatch):
    monkeypatch.setattr(settings(), 'enable_test_checkout', True)
    monkeypatch.setattr(settings(), 'razorpay_key_id', 'rzp_test_fixture')
    monkeypatch.setattr(settings(), 'razorpay_key_secret', 'fixture-secret')
    with sessions()() as db:
        configure_test_product(db)
        db.commit()


def test_test_inventory_requires_opt_in_and_test_keys(monkeypatch):
    monkeypatch.setattr(settings(), 'enable_test_checkout', False)
    with sessions()() as db:
        configure_test_product(db)
        assert db.get(Product, PRODUCT_ID) is None
        monkeypatch.setattr(settings(), 'enable_test_checkout', True)
        monkeypatch.setattr(settings(), 'razorpay_key_id', 'rzp_live_rejected')
        configure_test_product(db)
        assert db.get(Product, PRODUCT_ID) is None


def test_restart_preserves_test_stock_and_regular_inventory(monkeypatch, client):
    enable(monkeypatch)
    with sessions()() as db:
        db.get(Variant, VARIANT_ID).stock = 998
        db.get(Product, 'bottle').sale_enabled = False
        db.commit()
        configure_test_product(db)
        db.commit()
        assert db.get(Variant, VARIANT_ID).stock == 998
        assert db.get(Product, 'bottle').sale_enabled is False
    monkeypatch.setattr(settings(), 'enable_test_checkout', False)
    # Old test inventory cannot be purchased even before the next seed/restart.
    response = client.post('/api/checkout/quote', json={'items':[{'variant_id':VARIANT_ID,'quantity':1}]}, headers=headers())
    assert response.status_code == 409
    assert client.get('/api/catalog/products/' + PRODUCT_ID).json()['sale_enabled'] is False
    with sessions()() as db:
        configure_test_product(db)
        db.commit()
    assert client.get('/api/catalog/products/' + PRODUCT_ID).status_code == 404


def test_test_order_uses_gateway_only_without_delivery(monkeypatch, client):
    enable(monkeypatch)
    items = [{'variant_id':VARIANT_ID,'quantity':1}]
    quote = client.post('/api/checkout/quote', json={'items':items}, headers=headers()).json()
    assert quote['payment_test'] is True
    assert quote['total'] == '10.00' and quote['delivery'] == '0.00'
    data = payload(client, items)
    assert client.post('/api/orders', json=data, headers=headers()).status_code == 422
    response = client.post('/api/orders', json={**data,'payment':'RAZORPAY'}, headers=headers())
    assert response.status_code == 200, response.text
    assert response.json()['status'] == 'Awaiting Payment'
    with sessions()() as db:
        assert db.get(Variant, VARIANT_ID).stock == 999
        assert db.scalar(select(func.count()).select_from(Order)) == 1
        assert db.get(Variant, VARIANT_ID).price == Decimal('10.00')
    mixed = client.post('/api/checkout/quote', json={'items':items + [{'variant_id':'sku-bottle','quantity':1}]}, headers=headers())
    assert mixed.status_code == 409
