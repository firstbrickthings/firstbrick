import pytest
from sqlalchemy import select
from app.config import settings
from app.db import sessions
from app.models import StoreDocument, LoginSession
from app.owner_password import KEY, PHONE, password_hash, setup_owner_password
from conftest import headers

TEMP='temporary-owner-fixture-password'
NEW='new-owner-fixture-password-2026'

@pytest.fixture
def provision(monkeypatch):
    monkeypatch.setattr(settings(),'auth_secret','test-owner-session-secret-at-least-thirty-two')
    monkeypatch.setattr(settings(),'owner_password_bootstrap_hash',password_hash(TEMP))
    monkeypatch.setattr(settings(),'admin_verified_phones',PHONE)
    with sessions()() as db:setup_owner_password(db);db.commit()


def signin(client,password=TEMP,phone=PHONE):
    return client.post('/api/auth/owner/password',json={'phone':phone,'password':password})


def test_password_required_and_first_login_cannot_manage_until_password_changed(client,provision):
    assert signin(client,'Hadhi').status_code==401
    assert signin(client,TEMP,'9999999999').status_code==401
    assert client.get('/api/admin/products').status_code==401
    login=signin(client);assert login.status_code==200,login.text
    data=login.json();assert data['password_change_required'] and not data['user']['is_admin']
    assert 'httponly' in login.headers['set-cookie'].lower()
    assert client.get('/api/admin/products').status_code==403
    assert client.get('/api/auth/session').json()['user']['is_admin'] is False
    body={'current_password':TEMP,'password':NEW}
    assert client.post('/api/auth/owner/password/change',json=body).status_code==403
    csrf={'X-BabyOne-CSRF':data['csrf']}
    assert client.post('/api/auth/owner/password/change',json=body,headers={**csrf,'Origin':'https://attacker.example'}).status_code==403
    result=client.post('/api/auth/owner/password/change',json=body,headers=csrf)
    assert result.status_code==200,result.text
    assert result.json()['user']['is_admin'] and not result.json()['password_change_required']
    assert client.get('/api/admin/products').status_code==200
    assert client.get('/api/auth/session').json()['user']['is_admin'] is True
    with sessions()() as db:
        doc=db.get(StoreDocument,KEY);assert TEMP not in str(doc.value) and NEW not in str(doc.value)
        assert db.scalar(select(LoginSession).where(LoginSession.revoked_at.is_not(None)))
        # Deployment bootstrap does not reset a chosen password.
        value=doc.value.copy();setup_owner_password(db);db.commit();assert doc.value==value
    csrf=result.json()['csrf'];assert client.post('/api/auth/logout',headers={'X-BabyOne-CSRF':csrf}).status_code==200
    assert client.get('/api/admin/products').status_code==401
    assert signin(client,NEW,'9645762324').json()['user']['is_admin'] is True


def test_password_endpoint_is_rate_limited_and_customer_cannot_change_owner_password(client,provision):
    assert client.post('/api/auth/owner/password/change',json={'current_password':TEMP,'password':NEW},headers=headers()).status_code==403
    for _ in range(8):assert signin(client,'wrong').status_code==401
    assert signin(client).status_code==429


def test_customer_cannot_claim_admin_with_owner_phone_or_password_fields(client,provision):
    assert client.get('/api/admin/products',headers=headers()).status_code==403
    assert client.post('/api/auth/owner/password',json={'phone':PHONE,'name':'hadhi'}).status_code==422
    assert client.get('/api/store/content').json().get(KEY) is None
    assert client.get('/api/admin/content/'+KEY,headers=headers('owner')).status_code==404
