from concurrent.futures import ThreadPoolExecutor
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from app.db import sessions
from app.main import app
from app.models import Order, Product, Variant
from conftest import headers

ITEMS = [{'variant_id': 'sku-bottle', 'quantity': 2}]
SHIPPING = {'name': 'Test Parent', 'address': '12 Test Street', 'city': 'Kochi', 'state': 'Kerala', 'pin': '682001', 'email': ''}


def payload(client, items=None, key='test-order-request-001'):
    items = items or ITEMS
    response = client.post('/api/checkout/quote', json={'items': items}, headers=headers())
    assert response.status_code == 200, response.text
    return {'items': items, 'shipping': SHIPPING, 'quote_hash': response.json()['quote_hash'], 'idempotency_key': key}


def test_auth_and_ownership(client):
    assert client.get('/api/me').status_code == 401
    assert client.get('/api/me', headers=headers('bad')).status_code == 401
    assert client.get('/api/admin/orders', headers=headers()).status_code == 403
    assert client.put('/api/admin/products/bottle', json={}, headers=headers()).status_code == 403
    order = client.post('/api/orders', json=payload(client), headers=headers()).json()
    assert client.get('/api/me/orders/' + order['id'], headers=headers('other')).status_code == 404
    assert client.get('/api/me/orders/' + order['id'], headers=headers('case-other')).status_code == 404
    assert client.get('/api/me/orders', headers=headers('other')).json()['items'] == []
    assert client.get('/api/me/orders', headers=headers()).json()['items'][0]['id'] == order['id']


def test_server_totals_and_idempotency(client):
    data = payload(client)
    response = client.post('/api/orders', json=data, headers=headers())
    assert response.status_code == 200, response.text
    order = response.json()
    assert order['subtotal'] == '998.00'
    assert order['delivery'] == '60.00'
    assert order['total'] == '1058.00'
    assert order['phone'] == '9999999999'
    again = client.post('/api/orders', json=data, headers=headers())
    assert again.json()['id'] == order['id']
    with sessions()() as db:
        assert db.get(Variant, 'sku-bottle').stock == 3
        assert db.scalar(select(func.count()).select_from(Order)) == 1
    changed = {**data, 'shipping': {**SHIPPING, 'name': 'Someone Else'}}
    assert client.post('/api/orders', json=changed, headers=headers()).status_code == 409


def test_payload_cannot_set_prices_or_identity(client):
    data = payload(client)
    for extra in [{'total': '0.01'}, {'phone': '1111111111'}, {'customer_uid': 'other-uid'}, {'payment': 'Card'}]:
        assert client.post('/api/orders', json={**data, **extra}, headers=headers()).status_code == 422
    assert client.post('/api/checkout/quote', json={'items': [{**ITEMS[0], 'price': '0.01'}]}, headers=headers()).status_code == 422
    for qty in [0, -1, 1.5, True, 101]:
        assert client.post('/api/checkout/quote', json={'items': [{'variant_id': 'sku-bottle', 'quantity': qty}]}, headers=headers()).status_code == 422


def test_duplicate_lines_and_stock_validation(client):
    data = {'items': [{'variant_id': 'sku-bottle', 'quantity': 3}, {'variant_id': 'sku-bottle', 'quantity': 3}]}
    assert client.post('/api/checkout/quote', json=data, headers=headers()).status_code == 409
    with sessions()() as db:
        db.get(Product, 'bottle').sale_enabled = False
        db.commit()
    assert client.post('/api/checkout/quote', json={'items': ITEMS}, headers=headers()).status_code == 409


def test_price_change_rolls_back_order(client):
    data = payload(client)
    with sessions()() as db:
        db.get(Variant, 'sku-bottle').price = '599.00'
        db.commit()
    result = client.post('/api/orders', json=data, headers=headers())
    assert result.status_code == 409
    with sessions()() as db:
        assert db.get(Variant, 'sku-bottle').stock == 5
        assert db.scalar(select(func.count()).select_from(Order)) == 0


def test_cancel_restocks_once_and_status_rules(client):
    order = client.post('/api/orders', json=payload(client), headers=headers()).json()
    assert client.patch('/api/admin/orders/' + order['id'], json={'status': 'Delivered'}, headers=headers('owner')).status_code == 409
    for _ in range(2):
        result = client.patch('/api/admin/orders/' + order['id'], json={'status': 'Cancelled'}, headers=headers('owner'))
        assert result.status_code == 200, result.text
    with sessions()() as db:
        assert db.get(Variant, 'sku-bottle').stock == 5


def test_concurrent_buyers_cannot_oversell(client):
    data = payload(client, items=[{'variant_id': 'sku-bottle', 'quantity': 4}])
    def buy(number):
        with TestClient(app) as c:
            return c.post('/api/orders', json={**data, 'idempotency_key': f'parallel-request-{number:03d}'}, headers=headers('customer' if number == 1 else 'other')).status_code
    with ThreadPoolExecutor(max_workers=2) as workers:
        codes = sorted(workers.map(buy, [1, 2]))
    assert codes == [200, 409], codes
    with sessions()() as db:
        assert db.get(Variant, 'sku-bottle').stock == 1


def test_concurrent_retries_create_one_order(client):
    data = payload(client, items=[{'variant_id':'sku-bottle','quantity':5}])
    def buy(_):
        with TestClient(app) as c:
            return c.post('/api/orders', json=data, headers=headers())
    with ThreadPoolExecutor(max_workers=2) as workers:
        responses = list(workers.map(buy, [1, 2]))
    assert [r.status_code for r in responses] == [200, 200], [r.text for r in responses]
    assert responses[0].json()['id'] == responses[1].json()['id']
    with sessions()() as db:
        assert db.get(Variant, 'sku-bottle').stock == 0
        assert db.scalar(select(func.count()).select_from(Order)) == 1


def test_product_edit_conflicts_and_create(client):
    response = client.get('/api/admin/products', headers=headers('owner'))
    product = response.json()['items'][0]
    data = {k: product[k] for k in ['name', 'category_id', 'description', 'image', 'active', 'sale_enabled', 'variants']}
    data['expected_version'] = product['version']
    assert client.put('/api/admin/products/bottle', json=data, headers=headers('owner')).status_code == 200
    assert client.put('/api/admin/products/bottle', json=data, headers=headers('owner')).status_code == 409
    data['variants'] = [{'label': 'Small', 'price': '100.00', 'stock': 3}]
    data['expected_version'] = None
    created = client.post('/api/admin/products', json=data, headers=headers('owner'))
    assert created.status_code == 201, created.text
    invalid = client.post('/api/admin/products', json={**data, 'category_id': 'missing'}, headers=headers('owner'))
    assert invalid.status_code == 422


def test_catalog_and_profile(client):
    assert client.get('/api/catalog/products?limit=101').status_code == 422
    assert client.get('/api/catalog/products?q=%25').json()['total'] == 0
    assert client.get('/api/catalog/products/bottle').json()['currency'] == 'INR'
    assert client.put('/api/me/profile', json=SHIPPING, headers=headers()).status_code == 200
    assert client.get('/api/me/profile', headers=headers()).json()['details']['name'] == 'Test Parent'
    assert client.get('/api/me/profile', headers=headers('other')).json()['details'] == {}


def test_pattern_availability_is_server_controlled(client):
    product=client.get('/api/admin/products',headers=headers('owner')).json()['items'][0]
    data={k:product[k] for k in ['name','category_id','description','image','active','sale_enabled','variants']}
    data.update(expected_version=product['version'],patterns=[{'id':'blue','name':'Blue','available':False}])
    response=client.put('/api/admin/products/bottle',json=data,headers=headers('owner'))
    assert response.status_code==200,response.text
    quote=client.post('/api/checkout/quote',json={'items':[{'variant_id':'sku-bottle','quantity':1,'pattern_id':'blue'}]},headers=headers())
    assert quote.status_code==409
