import logging
from pathlib import Path
from uuid import uuid4
from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.concurrency import run_in_threadpool
from sqlalchemy import func, or_, select, text
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session
from .auth import Identity, admin, identity
from .config import settings
from .db import database
from .models import Category, Customer, Order, Product, Variant
from .schemas import CategoryInput, OrderInput, ProductInput, QuoteInput, Shipping, StatusInput
from .services import calculate, change_status, order_view, place_order, product_view

ROOT = Path(__file__).resolve().parents[2]
app = FastAPI(title='BabyOne store API', version='1.0.0', docs_url='/api/docs', openapi_url='/api/openapi.json')
app.add_middleware(CORSMiddleware, allow_origins=settings().origins, allow_credentials=False,
                   allow_methods=['GET', 'POST', 'PUT', 'PATCH'], allow_headers=['Authorization', 'Content-Type'])


@app.middleware('http')
async def headers(request: Request, call_next):
    # Bound JSON bodies before parsing; the reverse proxy should also enforce this limit.
    if request.method in {'POST', 'PUT', 'PATCH'}:
        length = request.headers.get('content-length')
        if length and (not length.isdigit() or int(length) > 262144):
            return JSONResponse({'detail': 'Request is too large.'}, status_code=413)
        content = await request.body()
        if len(content) > 262144:
            return JSONResponse({'detail': 'Request is too large.'}, status_code=413)
    response = await call_next(request)
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
    if request.url.path.startswith('/api/'):
        response.headers['Cache-Control'] = 'no-store'
    return response


@app.exception_handler(OperationalError)
async def database_error(request, error):
    logging.getLogger(__name__).error('Database operation failed (%s)', type(error).__name__)
    return JSONResponse({'detail': 'Store database is temporarily unavailable. Please retry.'}, status_code=503)


@app.get('/api/health')
def health():
    return {'status': 'ok'}


@app.get('/api/ready')
def ready(db: Session = Depends(database)):
    db.execute(text('SELECT 1'))
    db.scalar(select(func.count()).select_from(Category))
    return {'database': 'ready'}


@app.get('/api/me')
def me(user: Identity = Depends(identity)):
    return {'uid': user.uid, 'phone': user.phone, 'is_admin': user.admin}


@app.get('/api/me/profile')
def profile(user: Identity = Depends(identity), db: Session = Depends(database)):
    customer = db.get(Customer, user.uid)
    return {'phone': user.phone, 'details': customer.details if customer else {}}


@app.put('/api/me/profile')
def save_profile(data: Shipping, user: Identity = Depends(identity), db: Session = Depends(database)):
    customer = db.get(Customer, user.uid)
    if not customer:
        customer = Customer(uid=user.uid, phone=user.phone)
        db.add(customer)
    customer.phone, customer.details = user.phone, data.model_dump()
    db.commit()
    return {'phone': user.phone, 'details': customer.details}


@app.get('/api/catalog/categories')
def categories(db: Session = Depends(database)):
    return [{'id': c.id, 'name': c.name, 'delivery_fee': str(c.delivery_fee)} for c in db.scalars(select(Category).order_by(Category.name))]


def product_list(db, offset, limit, q='', category=None, include_hidden=False):
    query = select(Product)
    if not include_hidden:
        query = query.where(Product.active.is_(True))
    if q:
        query = query.where(or_(Product.name.contains(q, autoescape=True), Product.id.contains(q, autoescape=True)))
    if category:
        query = query.where(Product.category_id == category)
    total = db.scalar(select(func.count()).select_from(query.subquery()))
    records = db.scalars(query.order_by(Product.id).offset(offset).limit(limit)).unique().all()
    return {'items': [product_view(p) for p in records], 'total': total, 'offset': offset, 'limit': limit}


@app.get('/api/catalog/products')
def products(offset: int = Query(0, ge=0), limit: int = Query(24, ge=1, le=100),
             q: str = Query('', max_length=100), category: str | None = None, db: Session = Depends(database)):
    return product_list(db, offset, limit, q, category)


@app.get('/api/catalog/products/{product_id}')
def product(product_id: str, db: Session = Depends(database)):
    record = db.get(Product, product_id)
    if not record or not record.active:
        raise HTTPException(404, 'Product not found.')
    return product_view(record)


@app.post('/api/checkout/quote')
def quote(data: QuoteInput, user: Identity = Depends(identity), db: Session = Depends(database)):
    result, *_ = calculate(db, data.items)
    return result


@app.post('/api/orders')
def create_order(data: OrderInput, user: Identity = Depends(identity), db: Session = Depends(database)):
    if data.payment=='RAZORPAY':
        from .payments import Gateway
        Gateway()
    return order_view(place_order(db, user, data))


@app.get('/api/me/orders')
def my_orders(offset: int = Query(0, ge=0), limit: int = Query(25, ge=1, le=100),
              user: Identity = Depends(identity), db: Session = Depends(database)):
    query = select(Order).where(Order.customer_uid == user.uid)
    total = db.scalar(select(func.count()).select_from(query.subquery()))
    return {'items': [order_view(o) for o in db.scalars(query.order_by(Order.created_at.desc()).offset(offset).limit(limit))], 'total': total}


@app.get('/api/me/orders/{order_id}')
def my_order(order_id: str, user: Identity = Depends(identity), db: Session = Depends(database)):
    record = db.scalar(select(Order).where(Order.id == order_id, Order.customer_uid == user.uid))
    if not record:
        raise HTTPException(404, 'Order not found.')
    return order_view(record)


@app.get('/api/admin/orders')
def admin_orders(offset: int = Query(0, ge=0), limit: int = Query(25, ge=1, le=100),
                 user: Identity = Depends(admin), db: Session = Depends(database)):
    total = db.scalar(select(func.count()).select_from(Order))
    return {'items': [order_view(o) for o in db.scalars(select(Order).order_by(Order.created_at.desc()).offset(offset).limit(limit))], 'total': total}


@app.patch('/api/admin/orders/{order_id}')
def status(order_id: str, data: StatusInput, user: Identity = Depends(admin), db: Session = Depends(database)):
    return order_view(change_status(db, order_id, data.status, user))


@app.get('/api/admin/products')
def admin_products(offset: int = Query(0, ge=0), limit: int = Query(24, ge=1, le=100),
                   q: str = Query('', max_length=100), user: Identity = Depends(admin), db: Session = Depends(database)):
    return product_list(db, offset, limit, q, include_hidden=True)


def write_product(db, data, record):
    with db.no_autoflush:
        if not db.get(Category, data.category_id):
            raise HTTPException(422, 'Choose an existing category.')
    if data.sale_enabled and (not any(v.enabled for v in data.variants) or any(v.enabled and v.price <= 0 for v in data.variants)):
        raise HTTPException(422, 'Approve a positive selling price before enabling sales.')
    ids = [v.id for v in data.variants if v.id]
    if len(ids) != len(set(ids)):
        raise HTTPException(422, 'Variant IDs must be unique.')
    current = {v.id: v for v in record.variants}
    if set(ids) - set(current):
        raise HTTPException(422, 'A variant does not belong to this product.')
    record.name, record.category_id = data.name, data.category_id
    record.description, record.image = data.description, data.image
    record.active, record.sale_enabled = data.active, data.sale_enabled
    record.metadata_json = {**(record.metadata_json or {}), 'patterns': [pattern.model_dump() for pattern in data.patterns]}
    for variant in current.values():
        variant.enabled = False  # Preserve historic variant IDs and order references.
    for position, item in enumerate(data.variants):
        variant = current.get(item.id) if item.id else None
        if not variant:
            variant = Variant(id=str(uuid4()), product_id=record.id)
            db.add(variant)
        variant.label, variant.price, variant.stock = item.label, item.price, item.stock
        variant.position, variant.enabled = position, item.enabled
    db.flush()
    db.expire(record, ['variants', 'category'])
    db.commit()
    return product_view(record)


@app.post('/api/admin/products', status_code=201)
def new_product(data: ProductInput, user: Identity = Depends(admin), db: Session = Depends(database)):
    record = Product(id='bo-owner-' + uuid4().hex, name=data.name, category_id=data.category_id, metadata_json={}, version=1)
    record.variants = []
    db.add(record)
    return write_product(db, data, record)


@app.put('/api/admin/products/{product_id}')
def update_product(product_id: str, data: ProductInput, user: Identity = Depends(admin), db: Session = Depends(database)):
    record = db.scalar(select(Product).where(Product.id == product_id).with_for_update())
    if not record:
        raise HTTPException(404, 'Product not found.')
    if data.expected_version != record.version:
        raise HTTPException(409, 'This product changed. Reload it before saving.')
    record.version += 1
    return write_product(db, data, record)


@app.put('/api/admin/categories/{category_id}')
def save_category(category_id: str, data: CategoryInput, user: Identity = Depends(admin), db: Session = Depends(database)):
    record = db.get(Category, category_id)
    if not record:
        record = Category(id=category_id)
        db.add(record)
    record.name, record.delivery_fee = data.name, data.delivery_fee
    db.commit()
    return {'id': record.id, 'name': record.name, 'delivery_fee': str(record.delivery_fee)}


if (ROOT / 'assets').exists():
    app.mount('/assets', StaticFiles(directory=ROOT / 'assets'), name='assets')

    @app.get('/', include_in_schema=False)
    def storefront():
        return FileResponse(ROOT / 'index.html', headers={'Cache-Control': 'no-cache'})


from . import payments
from .schemas import PaymentVerification


@app.get('/api/payments/config')
def payment_config():
    config=settings()
    return {'razorpay_test_enabled':config.razorpay_key_id.startswith('rzp_test_') and bool(config.razorpay_key_secret),'test_mode':True}


@app.post('/api/payments/razorpay/{order_id}/checkout')
def payment_checkout(order_id:str,user:Identity=Depends(identity),db:Session=Depends(database)):
    return payments.begin(db,order_id,user)


@app.post('/api/payments/razorpay/{order_id}/verify')
def payment_verify(order_id:str,data:PaymentVerification,user:Identity=Depends(identity),db:Session=Depends(database)):
    return payments.verify(db,order_id,user,data)


@app.get('/api/payments/razorpay/{order_id}/status')
def payment_status(order_id:str,user:Identity=Depends(identity),db:Session=Depends(database)):
    return payments.refresh(db,order_id,user)


@app.post('/api/payments/razorpay/webhook')
async def payment_webhook(request:Request,db:Session=Depends(database)):
    return await run_in_threadpool(
        payments.webhook,db,await request.body(),request.headers.get('x-razorpay-signature',''),request.headers.get('x-razorpay-event-id',''))
