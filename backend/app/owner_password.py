"""Single owner password login, independent of paid SMS and customer authentication."""
import hashlib
import hmac
import secrets
from datetime import timedelta
from uuid import uuid4
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import Field
from sqlalchemy import select, update
from sqlalchemy.dialects.mysql import insert
from sqlalchemy.orm import Session
from .auth import Identity, identity
from .config import settings
from .db import database
from .email_security import SESSION_COOKIE, check_origin, cookie, csrf_for, fingerprint, read_cookie, secret_digest
from .models import AuthRateLimit, Customer, LoginSession, StoreDocument, now
from .schemas import Input

router = APIRouter(prefix='/api/auth/owner')
KEY = 'owner_password_login'
PHONE = '+919645762324'


def password_hash(password):
    salt = secrets.token_hex(16)
    digest = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt), n=16384, r=8, p=1, dklen=32).hex()
    return 'scrypt-v1$' + salt + '$' + digest


def password_matches(password, encoded):
    try:
        scheme, salt, digest = encoded.split('$')
        if scheme != 'scrypt-v1' or len(salt) != 32 or len(digest) != 64:
            return False
        actual = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt), n=16384, r=8, p=1, dklen=32).hex()
        return hmac.compare_digest(actual, digest)
    except (ValueError, TypeError, AttributeError):
        return False


def setup_owner_password(db):
    if db.get(StoreDocument, KEY) or not settings().owner_password_bootstrap_hash:
        return
    encoded = settings().owner_password_bootstrap_hash
    if not encoded.startswith('scrypt-v1$'):
        raise RuntimeError('Owner password bootstrap hash is invalid.')
    uid = 'password-owner-' + uuid4().hex
    db.add(Customer(uid=uid, phone=PHONE, details={'name': 'Hadhi'}, first_verified_at=now()))
    db.add(StoreDocument(key=KEY, value={'uid': uid, 'phone': PHONE, 'password_hash': encoded,
                                      'enabled': True, 'must_change': True}, version=1))


def throttle(db, request):
    timestamp = now()
    peer = request.client.host if request.client else 'unknown'
    for name in sorted(['owner-password-account', 'owner-password-peer:' + peer]):
        key = secret_digest(name)
        db.execute(insert(AuthRateLimit).values(key=key, window_at=timestamp, count=0, next_at=timestamp).on_duplicate_key_update(key=key))
        row = db.scalar(select(AuthRateLimit).where(AuthRateLimit.key == key).with_for_update())
        if timestamp - row.window_at >= timedelta(minutes=15):
            row.window_at, row.count = timestamp, 0
        if row.count >= 8:
            db.commit()
            raise HTTPException(429, 'Too many sign-in attempts. Please try again in 15 minutes.', headers={'Retry-After': '900'})
        row.count += 1
    db.commit()


def payload(record, token):
    changing = record['must_change']
    return {'user': {'uid': record['uid'], 'phone': PHONE, 'email': '', 'phone_verified': True,
                     'is_admin': not changing, 'details': {'name': 'Hadhi'}},
            'csrf': csrf_for(token), 'password_change_required': changing}


def issue(db, response, record):
    token = secrets.token_urlsafe(48)
    seconds = 600 if record['must_change'] else 8 * 3600
    db.add(LoginSession(token_digest=fingerprint(token), customer_uid=record['uid'], expires_at=now()+timedelta(seconds=seconds)))
    db.commit()
    cookie(response, SESSION_COOKIE, token, seconds)
    response.headers['Cache-Control'] = 'no-store'
    return payload(record, token)


class PasswordLogin(Input):
    phone: str = Field(min_length=10, max_length=16)
    password: str = Field(min_length=1, max_length=256)


class ChangePassword(Input):
    current_password: str = Field(min_length=1, max_length=256)
    password: str = Field(min_length=12, max_length=256)


@router.post('/password')
def login(data: PasswordLogin, request: Request, response: Response, db: Session = Depends(database)):
    check_origin(request)
    throttle(db, request)
    doc = db.get(StoreDocument, KEY)
    digits = ''.join(c for c in data.phone if c.isdigit())
    if digits.startswith('91') and len(digits) == 12:
        digits = digits[2:]
    if not doc or not doc.value.get('enabled'):
        raise HTTPException(503, 'Owner sign-in is being configured.')
    valid = password_matches(data.password, doc.value.get('password_hash', ''))
    if digits != PHONE[3:] or not valid:
        raise HTTPException(401, 'The owner phone number or password is incorrect.')
    return issue(db, response, doc.value)


@router.post('/password/change')
def change(data: ChangePassword, request: Request, response: Response,
           user: Identity = Depends(identity), db: Session = Depends(database)):
    if not user.owner_password:
        raise HTTPException(403, 'Sign in with the owner password first.')
    throttle(db, request)
    doc = db.scalar(select(StoreDocument).where(StoreDocument.key == KEY).with_for_update())
    if not doc or doc.value['uid'] != user.uid or not doc.value.get('enabled'):
        raise HTTPException(403, 'Owner sign-in is unavailable.')
    if not password_matches(data.current_password, doc.value['password_hash']):
        raise HTTPException(401, 'The current password is incorrect.')
    if password_matches(data.password, doc.value['password_hash']) or data.password.strip() == PHONE[3:]:
        raise HTTPException(422, 'Choose a different password with at least 12 characters.')
    doc.value = {**doc.value, 'password_hash': password_hash(data.password), 'must_change': False}
    doc.version += 1
    db.execute(update(LoginSession).where(LoginSession.customer_uid == user.uid).values(revoked_at=now()))
    return issue(db, response, doc.value)
