"""Shared publishing, measured store analytics and owner-managed media."""
import gzip
import json
import re
from datetime import datetime, timedelta, timezone
from urllib.parse import urlsplit
from uuid import uuid4
from zoneinfo import ZoneInfo
import boto3
from botocore.config import Config
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import RedirectResponse, Response
from pydantic import Field, field_validator
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from .auth import Identity, admin, identity
from .config import settings
from .db import database
from .models import Base, Category, Customer, MediaFile, Order, ReportingEvent, SiteReview, StoreDocument, StoreSnapshot, VisitSession, now
from .schemas import Input
from .shipping import ShippingConfig

router = APIRouter(prefix='/api')
PUBLIC_KEYS = {'hero', 'banners', 'videos', 'categories', 'fashion'}


def safe_url(value):
    if not isinstance(value, str) or len(value) > 2000:
        return False
    if re.search(r'''[\s<>"'`]''', value):
        return False
    if value.startswith('/api/media/'):
        return bool(re.fullmatch(r'/api/media/[a-f0-9-]{36}', value))
    if value.startswith('assets/'):
        return '..' not in value and '\\' not in value
    parsed = urlsplit(value)
    return parsed.scheme == 'https' and bool(parsed.hostname) and not parsed.username


def document_view(row):
    return {'key': row.key, 'value': row.value, 'version': row.version,
            'updated_at': row.updated_at.replace(tzinfo=timezone.utc).isoformat()}


class DocumentInput(Input):
    value: dict
    expected_version: int = Field(ge=0)


def validate_document(key, value):
    if key == 'shipping':
        return ShippingConfig.model_validate(value).model_dump(mode='json')
    if set(value) != {'items'} or not isinstance(value['items'], list) or len(value['items']) > 100:
        raise HTTPException(422, 'Use a list of up to 100 published items.')
    allowed = {
        'hero': {'id','image','published'},
        'banners': {'id','image','published'},
        'fashion': {'id','image','published'},
        'videos': {'id','title','author','productId','videoUrl','youtubeId','cover','published'},
        'categories': {'id','name','img','subcategories','published'},
    }[key]
    for item in value['items']:
        if not isinstance(item, dict) or set(item)-allowed:
            raise HTTPException(422, 'This content has unsupported fields.')
        if not isinstance(item.get('id'), str) or not 1 <= len(item['id']) <= 100:
            raise HTTPException(422, 'Each item needs an ID.')
        if not isinstance(item.get('published', True), bool):
            raise HTTPException(422, 'Choose published or hidden.')
        for field in ('image','img','videoUrl','cover'):
            if item.get(field) and not safe_url(item[field]):
                raise HTTPException(422, 'Use an HTTPS URL, an assets/ path or an uploaded website file.')
        for field in ('title','author','productId','name'):
            if field in item and (not isinstance(item[field],str) or len(item[field]) > 200):
                raise HTTPException(422, 'Text must be under 200 characters.')
        if key == 'categories':
            subs = item.get('subcategories', [])
            if not isinstance(subs,list) or len(subs)>50 or any(not isinstance(s,str) or len(s)>100 for s in subs):
                raise HTTPException(422, 'Use a list of subcategory names.')
        if key == 'videos' and (not item.get('title') or not (item.get('videoUrl') or re.fullmatch(r'[A-Za-z0-9_-]{11}',str(item.get('youtubeId',''))))):
            raise HTTPException(422, 'A video needs a title and a saved video URL.')
        if key in {'hero','banners','fashion'} and not item.get('image'):
            raise HTTPException(422, 'Choose an image.')
    ids = [item['id'] for item in value['items']]
    if len(ids) != len(set(ids)):
        raise HTTPException(422, 'Item IDs must be unique.')
    return value


@router.get('/store/content')
def public_content(db: Session = Depends(database)):
    result = {}
    for row in db.scalars(select(StoreDocument).where(StoreDocument.key.in_(PUBLIC_KEYS))):
        data = document_view(row)
        data['value'] = {'items': [v for v in row.value.get('items',[]) if v.get('published',True)]}
        result[row.key] = data
    revision=db.get(StoreDocument,'catalog_revision')
    result['_catalog']={'version':revision.version if revision else 0}
    return result


@router.get('/admin/content/{key}')
def get_content(key: str, user: Identity = Depends(admin), db: Session = Depends(database)):
    if key not in PUBLIC_KEYS | {'shipping'}:
        raise HTTPException(404, 'Section not found.')
    row = db.get(StoreDocument,key)
    return document_view(row) if row else {'key':key,'value':ShippingConfig().model_dump(mode='json') if key=='shipping' else {'items':[]},'version':0}


@router.put('/admin/content/{key}')
def save_content(key: str, data: DocumentInput, user: Identity = Depends(admin), db: Session = Depends(database)):
    if key not in PUBLIC_KEYS | {'shipping'}:
        raise HTTPException(404, 'Section not found.')
    try:
        value = validate_document(key,data.value)
    except ValueError:
        raise HTTPException(422,'Check the postal zones, increasing weight bands and non-negative rates. Use the form’s stated limits.') from None
    row = db.scalar(select(StoreDocument).where(StoreDocument.key==key).with_for_update())
    if data.expected_version != (row.version if row else 0):
        raise HTTPException(409, 'Another session updated this section. Reload before saving.')
    if not row:
        row = StoreDocument(key=key,value=value,version=1)
        db.add(row)
    else:
        row.value, row.version = value, row.version+1
    if key == 'categories':
        for item in value['items']:
            if not item.get('name') or len(item['name'])>100 or re.search(r'''[<>"'`]''',item['name']):
                raise HTTPException(422,'Each category needs a name of up to 100 characters.')
            category=db.get(Category,item['id'])
            same_name=db.scalar(select(Category).where(Category.name==item['name']))
            if same_name and same_name.id!=item['id']:
                raise HTTPException(409,'A category already has that name. Reload the category editor before saving.')
            if category:category.name=item['name']
            else:db.add(Category(id=item['id'],name=item['name'],delivery_fee=0))
    db.commit()
    return document_view(row)


class ReviewInput(Input):
    name: str = Field(min_length=2,max_length=100)
    message: str = Field(min_length=3,max_length=2000)
    rating: int = Field(ge=1,le=5,strict=True)
    published: bool = False
    position: int = Field(default=0,ge=0,le=10000)


def review_view(row):
    return {key:getattr(row,key) for key in ['id','name','message','rating','published','position']}


@router.get('/store/reviews')
def public_reviews(db: Session = Depends(database)):
    return [review_view(row) for row in db.scalars(select(SiteReview).where(SiteReview.published.is_(True)).order_by(SiteReview.position,SiteReview.created_at))]


@router.get('/admin/reviews')
def admin_reviews(user: Identity = Depends(admin),db: Session = Depends(database)):
    return [review_view(row) for row in db.scalars(select(SiteReview).order_by(SiteReview.position,SiteReview.created_at))]


@router.post('/admin/reviews',status_code=201)
def add_review(data: ReviewInput,user: Identity = Depends(admin),db: Session = Depends(database)):
    row = SiteReview(id=str(uuid4()),**data.model_dump())
    db.add(row); db.commit()
    return review_view(row)


@router.put('/admin/reviews/{review_id}')
def edit_review(review_id: str,data: ReviewInput,user: Identity = Depends(admin),db: Session = Depends(database)):
    row = db.get(SiteReview,review_id)
    if not row:
        raise HTTPException(404,'Review not found.')
    for key,value in data.model_dump().items():
        setattr(row,key,value)
    db.commit()
    return review_view(row)


@router.delete('/admin/reviews/{review_id}',status_code=204)
def delete_review(review_id: str,user: Identity = Depends(admin),db: Session = Depends(database)):
    row = db.get(SiteReview,review_id)
    if not row:
        raise HTTPException(404,'Review not found.')
    db.delete(row); db.commit()
    return Response(status_code=204)


class RegisterInput(Input):
    name: str = Field(default='',max_length=100)


@router.post('/me/register')
def register(data: RegisterInput = RegisterInput(),user: Identity = Depends(identity),db: Session = Depends(database)):
    row = db.get(Customer,user.uid)
    if not row:
        row = Customer(uid=user.uid,phone=user.phone,first_verified_at=now(),details={})
        db.add(row)
    if data.name and not row.details.get('name'):
        row.details={**row.details,'name':data.name}
    db.commit()
    return {'registered':True}


class VisitInput(Input):
    id: str = Field(pattern=r'^[a-f0-9-]{36}$')
    source: str = Field(default='Direct / Unknown',max_length=100)

    @field_validator('source')
    @classmethod
    def clean_source(cls,value):
        return re.sub(r'[^a-zA-Z0-9 ._/-]','',value)[:100] or 'Direct / Unknown'


@router.post('/store/visit',status_code=204)
def visit(data: VisitInput,db: Session = Depends(database)):
    # No IP, device fingerprint, phone, email, URL query or customer linkage is stored.
    row = db.get(VisitSession,data.id)
    stamp = now()
    if row and stamp-row.first_seen > timedelta(hours=24):
        raise HTTPException(409,'Start a new visit session.')
    if row:
        if stamp-row.last_seen < timedelta(seconds=25):
            return Response(status_code=204)
        row.last_seen = stamp
    else:
        row = VisitSession(id=data.id,source=data.source,first_seen=stamp,last_seen=stamp)
        db.add(row)
    db.commit()
    return Response(status_code=204)


@router.get('/admin/overview')
def overview(days: int = Query(7,ge=1,le=30),user: Identity = Depends(admin),db: Session = Depends(database)):
    if days not in {1,7,30}:
        raise HTTPException(422,'Choose Today, 7 Days or 30 Days.')
    local = datetime.now(ZoneInfo('Asia/Kolkata'))
    today = local.replace(hour=0,minute=0,second=0,microsecond=0)
    start = today-timedelta(days=days-1)
    utc = lambda d:d.astimezone(timezone.utc).replace(tzinfo=None)
    since,midnight,stamp = utc(start),utc(today),now()
    visits = db.scalars(select(VisitSession).where(VisitSession.first_seen>=since)).all()
    customers = db.scalars(select(Customer)).all()
    traffic,growth,sources = {},{},{}
    count = 24 if days==1 else days
    for i in range(count):
        label = (today+timedelta(hours=i)).strftime('%H:00') if days==1 else (start+timedelta(days=i)).strftime('%d %b')
        traffic[label],growth[label] = 0,0
    bucket = lambda dt:dt.replace(tzinfo=timezone.utc).astimezone(ZoneInfo('Asia/Kolkata')).strftime('%H:00' if days==1 else '%d %b')
    for row in visits:
        label = bucket(row.first_seen)
        if label in traffic:
            traffic[label]+=1
        sources[row.source]=sources.get(row.source,0)+1
    for row in customers:
        if row.first_verified_at and row.first_verified_at>=since:
            label=bucket(row.first_verified_at)
            if label in growth:
                growth[label]+=1
    active = db.scalar(select(func.count()).select_from(VisitSession).where(VisitSession.last_seen>=stamp-timedelta(minutes=5)))
    recent = sorted(customers,key=lambda c:c.first_verified_at or c.updated_at,reverse=True)[:12]
    return {'days':days,'timezone':'Asia/Kolkata','total_customers':len(customers),
            'new_signups_today':sum(bool(c.first_verified_at and c.first_verified_at>=midnight) for c in customers),
            'total_traffic':len(visits),'active_users':active,
            'traffic':[{'label':k,'value':v} for k,v in traffic.items()],
            'growth':[{'label':k,'value':v} for k,v in growth.items()],
            'sources':[{'name':k,'visits':v} for k,v in sorted(sources.items(),key=lambda p:-p[1])[:10]],
            'recent_customers':[{'name':c.details.get('name','Customer'),'phone':c.phone,
                                 'signup_at':c.first_verified_at.isoformat()+'Z' if c.first_verified_at else None} for c in recent],
            'note':'Traffic counts browser sessions, not unique people. Active users means sessions active in the last 5 minutes. Historic signup times are unknown; new registrations are tracked from this release.'}


@router.get('/admin/customers')
def customers(offset: int=Query(0,ge=0),limit: int=Query(50,ge=1,le=100),user: Identity=Depends(admin),db: Session=Depends(database)):
    rows=db.scalars(select(Customer).order_by(Customer.updated_at.desc()).offset(offset).limit(limit))
    return {'items':[{'uid':c.uid,'phone':c.phone,'details':c.details,'signup_at':c.first_verified_at.isoformat()+'Z' if c.first_verified_at else None} for c in rows],
            'total':db.scalar(select(func.count()).select_from(Customer))}


def storage():
    s=settings()
    if not all([s.media_endpoint,s.media_bucket,s.media_access_key,s.media_secret_key]):
        raise HTTPException(503,'Shared media storage is not configured yet.')
    return boto3.client('s3',endpoint_url=s.media_endpoint,region_name=s.media_region,
                        aws_access_key_id=s.media_access_key,aws_secret_access_key=s.media_secret_key,
                        config=Config(signature_version='s3v4',request_checksum_calculation='when_required',response_checksum_validation='when_required',s3={'addressing_style':'virtual'},connect_timeout=10,read_timeout=60,retries={'max_attempts':2}))


@router.post('/admin/media',status_code=201)
def upload(file: UploadFile=File(...),user: Identity=Depends(admin),db: Session=Depends(database)):
    size=file.size or 0
    if size<=0 or size>100*1024*1024:
        raise HTTPException(422,'Choose a file up to 100 MB.')
    head=file.file.read(32);file.file.seek(0)
    mime=None
    if head.startswith(b'\xff\xd8\xff'):mime='image/jpeg'
    elif head.startswith(b'\x89PNG\r\n\x1a\n'):mime='image/png'
    elif head.startswith(b'RIFF') and head[8:12]==b'WEBP':mime='image/webp'
    elif head.startswith(b'\x1aE\xdf\xa3'):mime='video/webm'
    elif len(head)>=12 and head[4:8]==b'ftyp' and head[8:12] in {b'isom',b'iso2',b'mp41',b'mp42',b'avc1',b'M4V ',b'qt  ',b'3gp4',b'3gp5'}:mime='video/mp4' if head[8:12]!=b'qt  ' else 'video/quicktime'
    if not mime:
        raise HTTPException(422,'Choose a JPG, PNG, WebP, MP4, MOV or WebM file.')
    if mime.startswith('image/') and size>12*1024*1024:
        raise HTTPException(422,'Choose an image up to 12 MB.')
    identifier=str(uuid4());key='published/'+identifier
    client=storage()
    try:
        client.upload_fileobj(file.file,settings().media_bucket,key,ExtraArgs={'ContentType':mime,'CacheControl':'public, max-age=86400'})
    except Exception:
        raise HTTPException(503,'Media upload failed. Your published content has not changed.') from None
    row=MediaFile(id=identifier,object_key=key,content_type=mime,size=size)
    db.add(row);db.commit()
    return {'id':identifier,'url':'/api/media/'+identifier,'content_type':mime,'size':size}


@router.get('/media/{identifier}')
def media(identifier: str,db: Session=Depends(database)):
    row=db.get(MediaFile,identifier)
    if not row:raise HTTPException(404,'Media not found.')
    url=storage().generate_presigned_url('get_object',Params={'Bucket':settings().media_bucket,'Key':row.object_key},ExpiresIn=3600)
    return RedirectResponse(url,status_code=307,headers={'Cache-Control':'no-store'})


def export_data(db):
    data={}
    for table in Base.metadata.sorted_tables:
        if table.name=='store_snapshots':continue
        data[table.name]=[dict(row) for row in db.execute(select(table)).mappings()]
    return gzip.compress(json.dumps({'format':'babyone-mysql-v1','exported_at':now().isoformat()+'Z','tables':data},default=str).encode())


@router.get('/admin/backup')
def backup(user: Identity=Depends(admin),db: Session=Depends(database)):
    return Response(export_data(db),media_type='application/gzip',headers={'Content-Disposition':'attachment; filename="babyone-mysql-backup.json.gz"'})


@router.get('/admin/reporting')
def reporting(user: Identity=Depends(admin),db: Session=Depends(database)):
    s=settings()
    totals=dict(db.execute(select(ReportingEvent.status,func.count()).group_by(ReportingEvent.status)).all())
    return {'enabled':s.sheets_enabled and bool(s.sheets_url and s.sheets_secret),'counts':totals,
            'message':'MySQL is the primary database. Sheets delivery is enabled only after the signed receiver is configured.'}


def probe_storage():
    import logging
    if not settings().media_bucket:return
    try:
        storage().head_bucket(Bucket=settings().media_bucket)
        logging.getLogger('uvicorn.error').info('Shared media storage verified.')
    except Exception as error:
        logging.getLogger('uvicorn.error').warning('Shared media storage check failed (%s).',type(error).__name__)
