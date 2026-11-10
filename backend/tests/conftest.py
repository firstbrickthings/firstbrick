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
from app.db import engine, sessions
from app.main import app
from app.models import Base, Category, Product, Variant
from fastapi.testclient import TestClient


@pytest.fixture(autouse=True)
def isolated_database(monkeypatch):
    Base.metadata.drop_all(engine())
    Base.metadata.create_all(engine())
    with sessions()() as db:
        db.add(Category(id='feeding', name='Feeding', delivery_fee='60.00'))
        db.add(Product(id='bottle', name='Baby bottle', category_id='feeding', sale_enabled=True, metadata_json={}))
        db.flush()
        db.add(Variant(id='sku-bottle', product_id='bottle', label='250 ml', price='499.00', stock=5))
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
