import os
from pathlib import Path
import sys
import pytest
from sqlalchemy.engine import make_url

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
# Refuse to create/drop tables in anything except an explicitly named test database.
url = os.environ.get('DATABASE_URL', '')
if not url or not (make_url(url).database or '').endswith('_test'):
    raise RuntimeError('Set DATABASE_URL to a separate MySQL database whose name ends in _test.')
os.environ['ADMIN_FIREBASE_UIDS'] = 'owner-test-uid'
from app import auth
from app.config import settings
from app.db import engine, sessions
from app.main import app
from app.models import Base, Category, Product, Variant, StoreDocument
from fastapi.testclient import TestClient


@pytest.fixture(autouse=True)
def isolated_database(monkeypatch):
    for key,value in {'razorpay_mode':'test','razorpay_key_id':'rzp_test_fixture','razorpay_key_secret':'unit-test-secret-not-a-credential','razorpay_prepare_live':False,'razorpay_live_webhook_confirmed':False,'catalog_stock_five_once':False,'catalog_price_ten_once':False,'catalog_publish_prices_once':False,'shipping_flat_99_once':False,'shipping_policy_once':False,'auth_cookie_secure':False,'auth_secret':'','gmail_oauth_client_id':'','gmail_oauth_client_secret':'','admin_verified_emails':''}.items():monkeypatch.setattr(settings(),key,value)
    Base.metadata.drop_all(engine())
    Base.metadata.create_all(engine())
    with sessions()() as db:
        db.add(Category(id='feeding', name='Feeding', delivery_fee='60.00'))
        db.add(Product(id='bottle', name='Baby bottle', category_id='feeding', sale_enabled=True, metadata_json={'shipping':{'weight_kg':'0.5','length_cm':'10','width_cm':'10','height_cm':'10','bulky':False}}))
        db.flush()
        db.add(Variant(id='sku-bottle', product_id='bottle', label='250 ml', price='499.00', stock=5))
        db.add(StoreDocument(key='shipping',value={'confirmed':True,'cod_enabled':True,'zones':[{'id':'test-kerala','name':'Test Kerala','pin_prefixes':['68'],'bands':[{'up_to_kg':'1','price':'30'}],'extra_kg':'10','max_kg':'35'}]},version=1))
        db.commit()
    def verify(token):
        users = {'customer': ('customer-uid', '+919999999999'), 'other': ('other-uid', '+918888888888'),
                 'case-other': ('CUSTOMER-UID', '+917777777777'), 'owner': ('owner-test-uid', '+916666666666')}
        if token not in users:
            raise ValueError('Invalid token')
        uid, phone = users[token]
        return {'uid': uid, 'phone_number': phone}
    monkeypatch.setattr(auth, 'verify_token', verify)
    yield


@pytest.fixture
def client():
    with TestClient(app) as client:
        yield client


def headers(user='customer'):
    return {'Authorization': 'Bearer ' + user}
