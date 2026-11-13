"""Verified store mailbox connected through Google OAuth and HTTPS Gmail API."""
import base64
import hashlib
from email.message import EmailMessage
from urllib.parse import urlencode
import requests
from cryptography.fernet import Fernet,InvalidToken
from google.auth.exceptions import GoogleAuthError
from google.auth.transport.requests import Request as GoogleRequest
from google.oauth2 import id_token
from fastapi import HTTPException
from .config import settings
from .models import GmailCredential,StoreDocument,now

SCOPE='openid email https://www.googleapis.com/auth/gmail.send'


def missing_settings():
    cfg=settings()
    return [name for name,value in [('AUTH_SECRET',len(cfg.auth_secret)>=32),('GMAIL_OAUTH_CLIENT_ID',cfg.gmail_oauth_client_id),('GMAIL_OAUTH_CLIENT_SECRET',cfg.gmail_oauth_client_secret)] if not value]


def connected(db):
    return not missing_settings() and bool(db.get(GmailCredential,settings().auth_email_sender.lower()))


def ready(db):
    return settings().email_otp_enabled and connected(db)


def retired(db):
    row=db.get(StoreDocument,'email_auth_rollout')
    return bool(row and row.value.get('firebase_retired'))


def box():
    return Fernet(base64.urlsafe_b64encode(hashlib.sha256(settings().auth_secret.encode()).digest()))


def callback_url():
    return settings().public_store_url.rstrip('/')+'/api/auth/gmail/callback'


def authorization_url(state):
    return 'https://accounts.google.com/o/oauth2/v2/auth?'+urlencode({'client_id':settings().gmail_oauth_client_id,'redirect_uri':callback_url(),'response_type':'code','scope':SCOPE,'access_type':'offline','prompt':'consent','state':state,'login_hint':settings().auth_email_sender})


def exchange_and_store(db,code):
    cfg=settings()
    try:
        response=requests.post('https://oauth2.googleapis.com/token',data={'code':code,'client_id':cfg.gmail_oauth_client_id,'client_secret':cfg.gmail_oauth_client_secret,'redirect_uri':callback_url(),'grant_type':'authorization_code'},timeout=15)
        if response.status_code!=200:raise ValueError('oauth')
        data=response.json()
        claims=id_token.verify_oauth2_token(data['id_token'],GoogleRequest(),cfg.gmail_oauth_client_id)
        if claims.get('email','').lower()!=cfg.auth_email_sender.lower() or claims.get('email_verified') is not True:raise ValueError('mailbox')
        if not data.get('refresh_token') or not claims.get('sub') or 'https://www.googleapis.com/auth/gmail.send' not in data.get('scope','').split():raise ValueError('permissions')
    except (requests.RequestException,ValueError,KeyError,GoogleAuthError):
        raise HTTPException(502,'Google could not connect the configured store mailbox. Retry Connect Gmail and choose the correct store account.') from None
    row=db.get(GmailCredential,cfg.auth_email_sender.lower())
    value=box().encrypt(data['refresh_token'].encode()).decode()
    if row:row.encrypted_refresh_token=value;row.google_subject=claims['sub'];row.connected_at=now()
    else:db.add(GmailCredential(email=cfg.auth_email_sender.lower(),encrypted_refresh_token=value,google_subject=claims['sub']))
    db.commit()


def send_code(db,email,code):
    cfg=settings();row=db.get(GmailCredential,cfg.auth_email_sender.lower())
    if not ready(db):raise HTTPException(503,'Email sign-in is waiting for the store mailbox connection.')
    try:
        refresh=box().decrypt(row.encrypted_refresh_token.encode()).decode()
        response=requests.post('https://oauth2.googleapis.com/token',data={'client_id':cfg.gmail_oauth_client_id,'client_secret':cfg.gmail_oauth_client_secret,'refresh_token':refresh,'grant_type':'refresh_token'},timeout=15)
        if response.status_code!=200:raise ValueError('refresh')
        access=response.json()['access_token']
        message=EmailMessage();message['To']=email;message['From']='BabyOne <'+cfg.auth_email_sender.lower()+'>';message['Subject']='Your BabyOne sign-in code'
        message.set_content('Your BabyOne verification code is '+code+'.\n\nIt expires in 5 minutes and can only be used once. Never share this code. If you did not request it, ignore this email.\n\nBabyOne Store')
        raw=base64.urlsafe_b64encode(message.as_bytes()).decode()
        sent=requests.post('https://gmail.googleapis.com/gmail/v1/users/me/messages/send',headers={'Authorization':'Bearer '+access},json={'raw':raw},timeout=15)
        if sent.status_code not in (200,201) or not sent.json().get('id'):raise ValueError('send')
    except (requests.RequestException,ValueError,KeyError,InvalidToken):
        raise HTTPException(503,'The email could not be confirmed as sent. Wait a minute, request a new code and use the newest email.') from None
