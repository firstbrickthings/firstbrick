"""Email OTP, private cookie sessions and owner-only Gmail onboarding."""
import hmac
import re
import secrets
from datetime import timedelta
from uuid import uuid4
from fastapi import APIRouter,Depends,HTTPException,Request,Response
from fastapi.responses import RedirectResponse
from pydantic import Field,field_validator
from sqlalchemy import select
from sqlalchemy.dialects.mysql import insert
from sqlalchemy.orm import Session
from .auth import Identity,admin,identity,resolve_identity
from .config import settings
from .db import database
from .models import AuthRateLimit,Customer,EmailChallenge,EmailIdentity,GmailConnectState,LoginSession,StoreDocument,WhatsAppPreference,now
from .schemas import Input
from .email_security import SESSION_COOKIE,DEVICE_COOKIE,GOOGLE_COOKIE,check_origin,cookie,csrf_for,fingerprint,secret_digest,read_cookie,remove_cookie
from . import gmail_delivery as mail

router=APIRouter(prefix='/api')


def canonical_email(value):
    value=value.strip().lower()
    if len(value)>254 or not re.fullmatch(r"[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,63}",value):
        raise ValueError('Enter a valid email address.')
    return value


def contact_phone(value):
    digits=re.sub(r'\D','',value)
    if len(digits)==12 and digits.startswith('91'):digits=digits[2:]
    if not digits:return ''
    if len(digits)!=10:raise ValueError('Enter a 10-digit Indian mobile number.')
    return '+91'+digits


class StartEmail(Input):
    email:str=Field(min_length=3,max_length=254)
    name:str=Field(default='',max_length=100)
    phone:str=Field(default='',max_length=20)
    link_current:bool=False
    _email=field_validator('email')(canonical_email)
    _phone=field_validator('phone')(contact_phone)


class VerifyEmail(Input):
    challenge_id:str=Field(pattern=r'^[a-f0-9-]{36}$')
    code:str=Field(pattern=r'^\d{6}$')


class Contact(Input):
    phone:str=Field(min_length=10,max_length=20)
    _phone=field_validator('phone')(contact_phone)


def limits(db,request,email):
    timestamp=now().replace(microsecond=0)
    # Only the immediate peer address is used. Untrusted forwarded headers cannot bypass limits.
    peer=request.client.host if request.client else 'unknown'
    buckets=[('email:'+email,5,3600,60),('peer:'+peer,30,3600,0),('mailbox:'+settings().auth_email_sender,400,86400,0)]
    for name,maximum,seconds,cooldown in sorted(buckets):
        key=secret_digest('limit:'+name)
        db.execute(insert(AuthRateLimit).values(key=key,window_at=timestamp,count=0,next_at=timestamp).on_duplicate_key_update(key=key))
        row=db.scalar(select(AuthRateLimit).where(AuthRateLimit.key==key).with_for_update())
        if timestamp-row.window_at>=timedelta(seconds=seconds):row.window_at=timestamp;row.count=0
        if row.count>=maximum or row.next_at>timestamp:
            raise HTTPException(429,'Please wait before requesting another code. Check your inbox and spam folder.',headers={'Retry-After':'60'})
        row.count+=1;row.next_at=timestamp+timedelta(seconds=cooldown)


def session_payload(user,request,db):
    customer=db.get(Customer,user.uid)
    return {'user':{'uid':user.uid,'email':user.email,'phone':user.phone,'phone_verified':user.phone_verified,'is_admin':user.admin,'details':customer.details if customer else {}},'csrf':csrf_for(read_cookie(request,SESSION_COOKIE))}


@router.get('/auth/config')
def auth_config(db:Session=Depends(database)):
    available=mail.ready(db)
    return {'email_available':available,'phone_available':not mail.retired(db),'login_method':'email' if available or mail.retired(db) else 'phone',
            'sender':settings().auth_email_sender.lower(),'message':'Email sign-in is ready.' if available else 'Email delivery needs store attention. Contact BabyOne for help.' if mail.retired(db) else 'The store mailbox is being connected. Phone sign-in remains available.'}


@router.get('/auth/session')
def session(request:Request,db:Session=Depends(database)):
    if not read_cookie(request,SESSION_COOKIE):return {'user':None,'csrf':None}
    try:user=resolve_identity(request,None,db,check_csrf=False)
    except HTTPException as error:
        if error.status_code in (401,403):return {'user':None,'csrf':None}
        raise
    return session_payload(user,request,db)


@router.post('/auth/email/request')
def request_code(data:StartEmail,request:Request,response:Response,db:Session=Depends(database)):
    check_origin(request)
    if not mail.ready(db):raise HTTPException(503,'Email sign-in is waiting for the store mailbox connection. Use the available phone sign-in.')
    linked=None
    if data.link_current:
        from fastapi.security import HTTPAuthorizationCredentials
        scheme,_,token=request.headers.get('authorization','').partition(' ')
        linked=resolve_identity(request,HTTPAuthorizationCredentials(scheme=scheme,credentials=token) if token else None,db)
        customer=db.get(Customer,linked.uid)
        if not customer:db.add(Customer(uid=linked.uid,phone=linked.phone,details={},first_verified_at=now()));db.flush()
    limits(db,request,data.email)
    device=read_cookie(request,DEVICE_COOKIE) or secrets.token_urlsafe(32)
    identifier=str(uuid4());code=f'{secrets.randbelow(1000000):06d}'
    row=EmailChallenge(id=identifier,email=data.email,code_digest=secret_digest('otp:'+identifier+':'+code),device_digest=fingerprint(device),
        link_uid=linked.uid if linked else None,verified_phone=linked.legacy_phone or '' if linked else '',name=data.name,contact_phone=data.phone,expires_at=now()+timedelta(minutes=5))
    db.add(row);db.commit()
    try:mail.send_code(db,data.email,code)
    except HTTPException:
        row.state='failed';db.commit();raise
    row.state='sent';db.commit()
    cookie(response,DEVICE_COOKIE,device,600)
    return {'challenge_id':identifier,'expires_in':300,'resend_after':60,'message':'Check your inbox and spam folder for your BabyOne code.'}


@router.post('/auth/email/verify')
def verify_code(data:VerifyEmail,request:Request,response:Response,db:Session=Depends(database)):
    check_origin(request)
    row=db.scalar(select(EmailChallenge).where(EmailChallenge.id==data.challenge_id).with_for_update())
    device=read_cookie(request,DEVICE_COOKIE) or ''
    if not row or not device or not hmac.compare_digest(row.device_digest,fingerprint(device)):
        raise HTTPException(400,'This code request is unavailable. Request a new code on this device.')
    if row.consumed_at or row.state!='sent' or row.expires_at<=now() or row.attempts>=5:
        raise HTTPException(400,'This code expired or has already been used. Request a new code.')
    row.attempts+=1
    if not hmac.compare_digest(row.code_digest,secret_digest('otp:'+row.id+':'+data.code)):
        db.commit();raise HTTPException(400,'The code is incorrect. Check the email and try again.')
    row.consumed_at=now()
    account=db.scalar(select(EmailIdentity).where(EmailIdentity.email==row.email).with_for_update())
    if account and row.link_uid and account.customer_uid!=row.link_uid:
        db.commit();raise HTTPException(409,'This email already has a BabyOne account. Sign in to it; contact the store to review any duplicate accounts.')
    if not account:
        uid=row.link_uid or 'email-'+uuid4().hex
        existing=db.scalar(select(EmailIdentity).where(EmailIdentity.customer_uid==uid))
        if existing:
            db.commit();raise HTTPException(409,'This account already has a verified email. Contact the store to change it securely.')
        customer=db.get(Customer,uid)
        if not customer:customer=Customer(uid=uid,phone=row.contact_phone,details={'name':row.name,'email':row.email},first_verified_at=now());db.add(customer);db.flush()
        else:customer.details={**customer.details,'email':row.email}
        account=EmailIdentity(email=row.email,customer_uid=uid,verified_phone=row.verified_phone);db.add(account);db.flush()
    customer=db.get(Customer,account.customer_uid)
    # Entered contact details never prove phone ownership or grant a role.
    if not customer.phone and row.contact_phone:customer.phone=row.contact_phone
    if not customer.details.get('name') and row.name:customer.details={**customer.details,'name':row.name}
    token=secrets.token_urlsafe(48)
    db.add(LoginSession(token_digest=fingerprint(token),customer_uid=account.customer_uid,expires_at=now()+timedelta(days=14)))
    user=Identity(account.customer_uid,customer.phone,account.email,customer.phone==account.verified_phone and bool(account.verified_phone),account.verified_phone)
    # A correctly delivered and verified owner email completes the requested cutover.
    if user.admin and account.email==settings().auth_email_sender.lower() and mail.ready(db):
        rollout=db.get(StoreDocument,'email_auth_rollout')
        if rollout:rollout.value={'firebase_retired':True,'activated_by':user.uid};rollout.version+=1
        else:db.add(StoreDocument(key='email_auth_rollout',value={'firebase_retired':True,'activated_by':user.uid},version=1))
    db.commit();cookie(response,SESSION_COOKIE,token,14*86400)
    remove_cookie(response,DEVICE_COOKIE)
    return {'user':{'uid':user.uid,'email':user.email,'phone':user.phone,'phone_verified':user.phone_verified,'is_admin':user.admin,'details':customer.details},'csrf':csrf_for(token)}


@router.post('/auth/logout')
def logout(request:Request,response:Response,db:Session=Depends(database)):
    token=read_cookie(request,SESSION_COOKIE)
    row=db.get(LoginSession,fingerprint(token)) if token else None
    check_origin(request)
    if row and not row.revoked_at and row.expires_at>now():
        if not hmac.compare_digest(request.headers.get('x-babyone-csrf',''),csrf_for(token)):raise HTTPException(403,'Refresh your sign-in before signing out.')
        row.revoked_at=now();db.commit()
    remove_cookie(response,SESSION_COOKIE)
    return {'signed_out':True}


@router.post('/auth/contact')
def update_contact(data:Contact,user:Identity=Depends(identity),db:Session=Depends(database)):
    if not user.email:raise HTTPException(409,'Use verified phone sign-in to change the phone on this account.')
    customer=db.get(Customer,user.uid)
    if customer.phone!=data.phone:
        preference=db.get(WhatsAppPreference,user.uid)
        if preference:preference.order_updates=False;preference.cart_reminders=False
        from .carts import cancel_reminders
        cancel_reminders(db,user.uid)
        customer.phone=data.phone;db.commit()
    return {'phone':data.phone,'phone_verified':bool(user.legacy_phone and data.phone==user.legacy_phone)}


@router.get('/admin/auth/email')
def email_setup(user:Identity=Depends(admin),db:Session=Depends(database)):
    identity_row=db.get(EmailIdentity,settings().auth_email_sender.lower())
    return {'sender':settings().auth_email_sender.lower(),'connected':mail.connected(db),'email_available':mail.ready(db),'firebase_retired':mail.retired(db),
        'owner_email_verified':bool(identity_row),'missing':mail.missing_settings(),'redirect_uri':mail.callback_url(),
        'message':'Connect the store Gmail account, then verify its email code to finish switching login.'}


@router.post('/admin/auth/email/connect')
def start_gmail(request:Request,response:Response,user:Identity=Depends(admin),db:Session=Depends(database)):
    if mail.missing_settings():raise HTTPException(409,'Add the Gmail OAuth client settings privately in Railway first.')
    check_origin(request)
    if not db.get(Customer,user.uid):db.add(Customer(uid=user.uid,phone=user.phone,details={},first_verified_at=now()));db.flush()
    state=secrets.token_urlsafe(32);device=secrets.token_urlsafe(32)
    db.add(GmailConnectState(state_digest=fingerprint(state),device_digest=fingerprint(device),owner_uid=user.uid,expires_at=now()+timedelta(minutes=10)));db.commit()
    cookie(response,GOOGLE_COOKIE,device,600)
    return {'authorization_url':mail.authorization_url(state)}


@router.get('/auth/gmail/callback')
def gmail_callback(request:Request,state:str='',code:str='',error:str='',db:Session=Depends(database)):
    row=db.scalar(select(GmailConnectState).where(GmailConnectState.state_digest==fingerprint(state)).with_for_update())
    device=read_cookie(request,GOOGLE_COOKIE) or ''
    if error or not row or row.consumed_at or row.expires_at<=now() or not device or not hmac.compare_digest(row.device_digest,fingerprint(device)):
        raise HTTPException(400,'The Gmail connection was cancelled or expired. Return to Dashboard → Login & email and try again.')
    if not code or len(code)>4096:raise HTTPException(400,'Google did not supply a connection code.')
    row.consumed_at=now();db.commit();mail.exchange_and_store(db,code)
    response=RedirectResponse(settings().public_store_url.rstrip('/')+'/?email-setup=connected',status_code=303)
    remove_cookie(response,GOOGLE_COOKIE)
    response.headers['Referrer-Policy']='no-referrer'
    return response
