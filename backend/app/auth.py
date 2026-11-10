from dataclasses import dataclass
from functools import lru_cache
import firebase_admin
from firebase_admin import auth
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from .config import settings

bearer = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class Identity:
    uid: str
    phone: str

    @property
    def admin(self):
        return self.uid in settings().admins


@lru_cache
def firebase_app():
    # ADC uses GOOGLE_APPLICATION_CREDENTIALS or the host's workload identity.
    return firebase_admin.initialize_app(options={'projectId': settings().firebase_project_id}, name='babyone-api')


def verify_token(token: str):
    return auth.verify_id_token(token, app=firebase_app(), check_revoked=True)


def identity(credentials: HTTPAuthorizationCredentials | None = Depends(bearer)) -> Identity:
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


def admin(user: Identity = Depends(identity)) -> Identity:
    if not user.admin:
        raise HTTPException(403, 'Store administrator access is required.')
    return user
