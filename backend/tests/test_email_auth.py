"""Isolated email auth contracts. Mail delivery and payment providers are fakes."""
import json
from datetime import timedelta
from urllib.parse import parse_qs,urlparse
import pytest
from fastapi.testclient import TestClient
from fastapi import HTTPException
from sqlalchemy import select
from app.config import settings
from app.db import sessions
from app.main import app
from app.models import Customer,CustomerCart,EmailChallenge,EmailIdentity,GmailCredential,LoginSession,StoreDocument,now
from app import gmail_delivery as mail
from app.email_security import SESSION_COOKIE,fingerprint
from app.legacy import PREFIX
from conftest import headers
from test_live_payments import live
from test_payments import callback
from test_store import SHIPPING,payload


@pytest.fixture
def mailbox(monkeypatch):
    cfg=settings()
    for name,value in {'auth_secret':'email-unit-secret-is-long-enough-for-testing','gmail_oauth_client_id':'unit-client.apps.googleusercontent.com','gmail_oauth_client_secret':'unit-client-secret','admin_verified_emails':'babyonestores@gmail.com','admin_verified_phones':'+919645762324'}.items():monkeypatch.setattr(cfg,name,value)
    with sessions()() as db:db.add(GmailCredential(email=cfg.auth_email_sender,encrypted_refresh_token=mail.box().encrypt(b'unit-refresh-only').decode(),google_subject='unit-google-subject'));db.commit()
    codes={}
    monkeypatch.setattr(mail,'send_code',lambda db,email,code:codes.update({email:code}))
    return codes


def begin(client,mailbox,email='parent@example.com',phone='9645762324',link=False,auth=None):
    r=client.post('/api/auth/email/request',json={'email':email,'name':'Parent','phone':phone,'link_current':link},headers=auth or {})
    assert r.status_code==200,r.text
    return {'challenge_id':r.json()['challenge_id'],'code':mailbox[email.lower()]}


def sign_in(client,mailbox,email='parent@example.com',**kwargs):
    data=begin(client,mailbox,email,**kwargs)
    r=client.post('/api/auth/email/verify',json=data);assert r.status_code==200,r.text
    return r.json()


def test_mailbox_missing_does_not_disable_working_phone_login(client):
    cfg=client.get('/api/auth/config').json();assert not cfg['email_available'] and cfg['phone_available']
    r=client.post('/api/auth/email/request',json={'email':'parent@example.com'});assert r.status_code==503
    assert client.get('/api/me',headers=headers()).status_code==200
    assert client.get('/api/admin/auth/email',headers=headers()).status_code==403
    assert client.post('/api/admin/auth/email/connect',headers=headers('owner')).status_code==409


def test_email_cookie_session_does_not_grant_admin_from_entered_owner_phone(client,mailbox):
    result=sign_in(client,mailbox,email='Parent@Example.COM')
    assert result['user']['email']=='parent@example.com' and not result['user']['is_admin'] and not result['user']['phone_verified']
    me=client.get('/api/me').json();assert me['email']=='parent@example.com' and not me['is_admin']
    assert client.get('/api/admin/orders').status_code==403
    assert client.post('/api/me/register').status_code==403
    auth={'X-BabyOne-CSRF':result['csrf']}
    assert client.post('/api/me/register',headers=auth).status_code==200
    assert client.post('/api/me/register',headers={**auth,'Origin':'https://evil.example'}).status_code==403
    raw=client.cookies.get(SESSION_COOKIE)
    assert raw and 'token' not in result
    with sessions()() as db:
        assert db.get(LoginSession,fingerprint(raw))
        challenge=db.scalar(select(EmailChallenge));assert mailbox['parent@example.com'] not in challenge.code_digest
        assert challenge.consumed_at and challenge.attempts==1
    r=client.post('/api/auth/logout',headers=auth);assert r.status_code==200
    assert client.get('/api/me').status_code==401
    client.cookies.set(SESSION_COOKIE,raw);assert client.get('/api/me').status_code==401


def test_codes_are_device_bound_limited_expiring_and_one_time(client,mailbox):
    data=begin(client,mailbox)
    with TestClient(app) as other:
        assert other.post('/api/auth/email/verify',json=data).status_code==400
    assert client.post('/api/auth/email/request',json={'email':'parent@example.com'}).status_code==429
    wrong={**data,'code':'000000' if data['code']!='000000' else '111111'}
    for _ in range(5):assert client.post('/api/auth/email/verify',json=wrong).status_code==400
    assert client.post('/api/auth/email/verify',json=data).status_code==400
    expired=begin(client,mailbox,'other@example.com')
    with sessions()() as db:db.get(EmailChallenge,expired['challenge_id']).expires_at=now()-timedelta(seconds=1);db.commit()
    assert client.post('/api/auth/email/verify',json=expired).status_code==400
    valid=begin(client,mailbox,'valid@example.com')
    r=client.post('/api/auth/email/verify',json=valid);assert r.status_code==200,r.text
    assert client.post('/api/auth/email/verify',json=valid).status_code==400
    cookie=r.headers['set-cookie'];assert 'HttpOnly' in cookie and 'SameSite=lax' in cookie


def test_unverified_legacy_email_and_entered_phone_never_merge_customer_accounts(client,mailbox):
    with sessions()() as db:
        db.add(Customer(uid='old-private-customer',phone='+919645762324',details={'email':'parent@example.com','address':'Private old address'}))
        db.add(StoreDocument(key=PREFIX+'BO-PRIVATE',value={'id':'BO-PRIVATE','status':'Delivered','verified_phone':'+919645762324','dateISO':'2026-01-01T00:00:00+00:00','items':[]},version=1));db.commit()
    result=sign_in(client,mailbox)
    assert result['user']['uid']!='old-private-customer' and 'address' not in result['user']['details']
    assert client.get('/api/me/orders').json()['items']==[]
    assert client.get('/api/me/orders/BO-PRIVATE').status_code==404


def test_link_preserves_uid_saved_cart_orders_and_verified_phone(client,mailbox):
    order=client.post('/api/orders',json=payload(client),headers=headers()).json()
    with sessions()() as db:db.add(CustomerCart(customer_uid='customer-uid',items=[{'variant_id':'sku-bottle','quantity':1}],version=2));db.commit()
    result=sign_in(client,mailbox,link=True,auth=headers())
    assert result['user']['uid']=='customer-uid' and result['user']['phone_verified']
    assert client.get('/api/me/orders').json()['items'][0]['id']==order['id']
    assert client.get('/api/me/cart').json()['version']==2
    with sessions()() as db:assert db.get(EmailIdentity,'parent@example.com').verified_phone=='+919999999999'


def test_verified_owner_mail_switches_off_firebase_without_losing_dashboard(client,mailbox):
    result=sign_in(client,mailbox,email='babyonestores@gmail.com',link=True,auth=headers('owner'))
    assert result['user']['uid']=='owner-test-uid' and result['user']['is_admin']
    assert client.get('/api/auth/config').json()['phone_available'] is False
    assert client.get('/api/admin/orders').status_code==200
    with TestClient(app) as old:
        assert old.get('/api/me',headers=headers('owner')).status_code==401
    auth={'X-BabyOne-CSRF':result['csrf']}
    assert client.post('/api/admin/media',files={'file':('cover.png',b'fake','image/png')}).status_code==403
    # Cookie sessions also authorize private backup downloads, independently of Firebase.
    assert client.get('/api/admin/backup').status_code==200
    assert client.post('/api/auth/contact',json={'phone':'7034476592'},headers=auth).status_code==200
    assert client.get('/api/me').json()['is_admin'] is True


def test_email_customer_checkout_keeps_real_amount_and_verified_payment_contract(client,mailbox,live):
    with sessions()() as db:
        doc=db.get(StoreDocument,'shipping');doc.value={**doc.value,'pricing_mode':'flat','flat_rate':'99.00'}
        from app.models import Variant
        db.get(Variant,'sku-bottle').price=10;db.commit()
    result=sign_in(client,mailbox,phone='')
    auth={'X-BabyOne-CSRF':result['csrf']}
    assert client.post('/api/auth/contact',json={'phone':'7034476592'},headers=auth).status_code==200
    items=[{'variant_id':'sku-bottle','quantity':1}]
    quote=client.post('/api/checkout/quote',json={'items':items,'pin':'673661'},headers=auth).json()
    order=client.post('/api/orders',json={'items':items,'shipping':{**SHIPPING,'pin':'673661'},'payment':'RAZORPAY','quote_hash':quote['quote_hash'],'idempotency_key':'email-checkout-001'},headers=auth)
    assert order.status_code==200,order.text
    order=order.json();assert order['total']=='109.00' and order['phone']=='7034476592'
    checkout=client.post('/api/payments/razorpay/'+order['id']+'/checkout',headers=auth).json();assert checkout['checkout']['amount']==10900
    verified=client.post('/api/payments/razorpay/'+order['id']+'/verify',json=callback(live,checkout),headers=auth)
    assert verified.status_code==200 and verified.json()['payment_status']=='paid'


def test_gmail_connect_requires_owner_and_matching_browser_state(client,mailbox,monkeypatch):
    assert client.post('/api/admin/auth/email/connect',headers=headers()).status_code==403
    r=client.post('/api/admin/auth/email/connect',headers=headers('owner'));assert r.status_code==200,r.text
    url=r.json()['authorization_url'];query=parse_qs(urlparse(url).query)
    assert query['login_hint']==['babyonestores@gmail.com'] and query['access_type']==['offline']
    called=[];monkeypatch.setattr(mail,'exchange_and_store',lambda db,code:called.append(code))
    assert client.get('/api/auth/gmail/callback?state=bad&code=unit').status_code==400
    with TestClient(app) as outsider:assert outsider.get('/api/auth/gmail/callback',params={'state':query['state'][0],'code':'unit'}).status_code==400
    r=client.get('/api/auth/gmail/callback',params={'state':query['state'][0],'code':'unit'},follow_redirects=False)
    assert r.status_code==303 and called==['unit']
    assert client.get('/api/auth/gmail/callback',params={'state':query['state'][0],'code':'unit'}).status_code==400


def test_editable_product_details_are_shared_and_validated(client):
    p=client.get('/api/catalog/products/bottle').json()
    data={'name':p['name'],'category_id':p['category_id'],'variants':p['variants'],'expected_version':p['version'],'product_details':{'material':'Owner-confirmed cotton','care_instructions':'Wash gently'}}
    saved=client.put('/api/admin/products/bottle',json=data,headers=headers('owner'));assert saved.status_code==200,saved.text
    assert client.get('/api/catalog/products/bottle').json()['metadata']['product_details']['material']=='Owner-confirmed cotton'
    data['product_details']={'unsafe_field':'test'}
    assert client.put('/api/admin/products/bottle',json=data,headers=headers('owner')).status_code==422


def test_production_sessions_use_host_only_secure_cookies(client,mailbox,monkeypatch):
    monkeypatch.setattr(settings(),'auth_cookie_secure',True)
    with TestClient(app,base_url='https://testserver') as browser:
        data=begin(browser,mailbox,'secure@example.com')
        verified=browser.post('/api/auth/email/verify',json=data)
        assert verified.status_code==200,verified.text
        header=verified.headers['set-cookie']
        assert '__Host-babyone_session=' in header and 'Secure' in header and 'HttpOnly' in header and 'Path=/' in header and 'Domain=' not in header
        assert browser.get('/api/auth/session').json()['user']['email']=='secure@example.com'
        token=browser.cookies.get('__Host-babyone_session')
        with sessions()() as db:db.get(LoginSession,fingerprint(token)).expires_at=now()-timedelta(seconds=1);db.commit()
        assert browser.get('/api/auth/session').json()['user'] is None
        assert browser.get('/api/me').status_code==401
        assert browser.post('/api/auth/logout').status_code==200


def test_delivery_failure_never_makes_an_otp_verifiable(client,mailbox,monkeypatch):
    def failure(db,email,code):raise HTTPException(503,'Mail unavailable')
    monkeypatch.setattr(mail,'send_code',failure)
    r=client.post('/api/auth/email/request',json={'email':'failed@example.com'})
    assert r.status_code==503
    with sessions()() as db:
        challenge=db.scalar(select(EmailChallenge));assert challenge.state=='failed'
    assert client.post('/api/auth/email/request',json={'email':'failed@example.com'}).status_code==429


def test_gmail_oauth_encrypts_refresh_token_and_rejects_wrong_sender(client,mailbox,monkeypatch):
    class Reply:
        status_code=200
        def json(self):return {'id_token':'unit-id-token','refresh_token':'private-unit-refresh','scope':mail.SCOPE}
    monkeypatch.setattr(mail.requests,'post',lambda *args,**kwargs:Reply())
    monkeypatch.setattr(mail.id_token,'verify_oauth2_token',lambda *args,**kwargs:{'email':'babyonestores@gmail.com','email_verified':True,'sub':'verified-subject'})
    with sessions()() as db:
        mail.exchange_and_store(db,'one-use-oauth-code')
        credential=db.get(GmailCredential,'babyonestores@gmail.com')
        assert 'private-unit-refresh' not in credential.encrypted_refresh_token
        assert mail.box().decrypt(credential.encrypted_refresh_token.encode())==b'private-unit-refresh'
        before=credential.encrypted_refresh_token
        monkeypatch.setattr(mail.id_token,'verify_oauth2_token',lambda *args,**kwargs:{'email':'someoneelse@gmail.com','email_verified':True,'sub':'other-subject'})
        with pytest.raises(HTTPException):mail.exchange_and_store(db,'wrong-mailbox-code')
        assert credential.encrypted_refresh_token==before


def test_gmail_send_uses_authenticated_https_and_correct_sender(client,monkeypatch):
    import base64
    from email import message_from_bytes
    cfg=settings()
    for name,value in {'auth_secret':'email-unit-secret-is-long-enough-for-testing','gmail_oauth_client_id':'unit-client.apps.googleusercontent.com','gmail_oauth_client_secret':'unit-client-secret'}.items():monkeypatch.setattr(cfg,name,value)
    with sessions()() as db:db.add(GmailCredential(email=cfg.auth_email_sender,encrypted_refresh_token=mail.box().encrypt(b'private-refresh').decode(),google_subject='verified-subject'));db.commit()
    calls=[]
    class Reply:
        status_code=200
        def __init__(self,data):self.data=data
        def json(self):return self.data
    def post(url,**kwargs):
        calls.append((url,kwargs))
        return Reply({'access_token':'private-access'}) if url.endswith('/token') else Reply({'id':'mail-accepted'})
    monkeypatch.setattr(mail.requests,'post',post)
    with sessions()() as db:mail.send_code(db,'parent@example.com','123456')
    assert len(calls)==2 and calls[1][0]=='https://gmail.googleapis.com/gmail/v1/users/me/messages/send'
    assert calls[1][1]['headers']['Authorization']=='Bearer private-access'
    message=message_from_bytes(base64.urlsafe_b64decode(calls[1][1]['json']['raw']))
    assert message['From']=='BabyOne <babyonestores@gmail.com>' and message['To']=='parent@example.com'
    assert '123456' in message.get_payload() and calls[1][1]['timeout']==15
