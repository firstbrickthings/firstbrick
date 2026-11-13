from dataclasses import dataclass
from functools import lru_cache
import json
import hmac
import firebase_admin
from firebase_admin import auth, credentials
from fastapi import Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session
from .db import database
from .models import Customer, EmailIdentity, LoginSession, now
from .email_security import SESSION_COOKIE, check_origin, csrf_for, fingerprint, read_cookie
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from .config import settings

bearer = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class Identity:
    uid: str
    phone: str
    email: str = ''
    phone_verified: bool = True
    verified_phone: str = ''

    @property
    def legacy_phone(self):
        return self.verified_phone or (self.phone if self.phone_verified else None)

    @property
    def admin(self):
        config = settings()
        # Claims come from verified authentication, never an entered name or contact phone.
        return self.uid in config.admins or bool(self.email and self.email in config.admin_emails) or bool(self.legacy_phone and self.legacy_phone in config.admin_phones)


@lru_cache
def firebase_app():
    # ADC uses GOOGLE_APPLICATION_CREDENTIALS or the host's workload identity.
    config = settings()
    try:
        credential = credentials.Certificate(json.loads(config.firebase_service_account_json)) if config.firebase_service_account_json else None
        return firebase_admin.initialize_app(credential=credential, options={'projectId': config.firebase_project_id}, name='babyone-api')
    except (ValueError, TypeError, KeyError):
        raise RuntimeError('Firebase server credentials are not configured correctly.') from None


def verify_token(token: str):
    return auth.verify_id_token(token, app=firebase_app(), check_revoked=True)


def resolve_identity(request, credentials, db, check_csrf=True) -> Identity:
    token=read_cookie(request,SESSION_COOKIE)
    if token:
        session=db.get(LoginSession,fingerprint(token))
        if session and not session.revoked_at and session.expires_at>now():
            account=db.scalar(select(EmailIdentity).where(EmailIdentity.customer_uid==session.customer_uid))
            customer=db.get(Customer,session.customer_uid)
            if account and customer:
                if check_csrf and request.method in {'POST','PUT','PATCH','DELETE'}:
                    check_origin(request)
                    if not hmac.compare_digest(request.headers.get('x-babyone-csrf',''),csrf_for(token)):
                        raise HTTPException(403,'Refresh your sign-in before saving changes.')
                return Identity(customer.uid,customer.phone,account.email,bool(account.verified_phone and customer.phone==account.verified_phone),account.verified_phone)
    from .gmail_delivery import retired
    if retired(db):
        raise HTTPException(401,'Sign in using your email verification code.')
    if not credentials or credentials.scheme.lower() != 'bearer':
        raise HTTPException(401, 'Sign in with your verified phone number.', headers={'WWW-Authenticate': 'Bearer'})
    try:
        claims = verify_token(credentials.credentials)
    except (auth.InvalidIdTokenError, auth.RevokedIdTokenError, auth.UserDisabledError, ValueError):
        raise HTTPException(401, 'Your sign-in has expired. Sign in again.') from None
    except Exception:
        raise HTTPException(503, 'Sign-in verification is temporarily unavailable.') from None
    phone = claims.get('phone_number', '')
    if not claims.get('uid') or not phone.startswith('+91') or len(phone) != 13 or not phone[1:].isdigit():
        raise HTTPException(403, 'A verified Indian phone number is required.')
    return Identity(claims['uid'], phone)


def identity(request: Request, credentials: HTTPAuthorizationCredentials | None = Depends(bearer), db: Session = Depends(database)) -> Identity:
    return resolve_identity(request, credentials, db)


def admin(user: Identity = Depends(identity)) -> Identity:
    if not user.admin:
        raise HTTPException(403, 'Store administrator access is required.')
    return user
