"""Test-only Firebase stub. Refuses any database not explicitly named *_test."""
import os
from sqlalchemy.engine import make_url

if not (make_url(os.environ['DATABASE_URL']).database or '').endswith('_test'):
    raise RuntimeError('The browser test server requires an isolated *_test database.')
os.environ['ADMIN_FIREBASE_UIDS'] = 'owner-test-uid'
from app import auth
from app.main import app


def test_token(token):
    if token != 'browser-only-test-token':
        raise ValueError('Invalid test token')
    return {'uid': 'owner-test-uid', 'phone_number': '+919999999999'}


auth.verify_token = test_token
