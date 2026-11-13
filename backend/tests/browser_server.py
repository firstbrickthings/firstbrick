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

# Explicitly isolated end-to-end email fixture. Never imported by app.serve.
if os.environ.get('BABYONE_EMAIL_BROWSER_TEST') == '1':
    from app import gmail_delivery
    from app.config import settings
    config=settings()
    config.auth_secret='browser-email-secret-is-only-an-isolated-fixture'
    config.auth_cookie_secure=False
    config.gmail_oauth_client_id='browser-fixture.apps.googleusercontent.com'
    config.gmail_oauth_client_secret='browser-fixture-secret'
    config.admin_verified_emails='babyonestores@gmail.com'
    config.allowed_origins+=',http://127.0.0.1:8082'
    gmail_delivery.connected=lambda db:True
    sent_codes={}
    gmail_delivery.send_code=lambda db,email,code:sent_codes.update({email:code})
    @app.get('/__test__/mail-code')
    def last_fake_code(email:str):
        return {'code':sent_codes.get(email)}
