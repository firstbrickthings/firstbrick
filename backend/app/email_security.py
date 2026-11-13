"""Shared account, cookie and request protections. No OTP or token is logged."""
import hashlib
import hmac
from fastapi import HTTPException
from .config import settings

SESSION_COOKIE='babyone_session'
DEVICE_COOKIE='babyone_otp_device'
GOOGLE_COOKIE='babyone_gmail_connect'


def fingerprint(value):
    return hashlib.sha256(value.encode()).hexdigest()


def secret_digest(value):
    if len(settings().auth_secret)<32:
        raise HTTPException(503,'Email sign-in is being configured. Existing phone sign-in remains available.')
    return hmac.new(settings().auth_secret.encode(),value.encode(),hashlib.sha256).hexdigest()


def csrf_for(token):
    return secret_digest('csrf:'+token)


def check_origin(request):
    origin=request.headers.get('origin')
    permitted={settings().public_store_url.rstrip('/'),*(v.rstrip('/') for v in settings().origins)}
    if origin and origin.rstrip('/') not in permitted:
        raise HTTPException(403,'Open the BabyOne website to continue.')


def cookie_name(name):
    return '__Host-'+name if settings().auth_cookie_secure else name


def read_cookie(request,name):
    return request.cookies.get(cookie_name(name))


def remove_cookie(response,name):
    response.delete_cookie(cookie_name(name),path='/',secure=settings().auth_cookie_secure,httponly=True,samesite='lax')


def cookie(response,name,value,age):
    response.set_cookie(cookie_name(name),value,max_age=age,httponly=True,secure=settings().auth_cookie_secure,samesite='lax',path='/')
