"""Owner-requested sale activation, preserving prices and existing stock."""
import gzip
import json
from sqlalchemy import select
from .models import Product, StoreSnapshot
from .file_catalog_cleanup import is_uploaded
from .services import touch_catalog

MARKER='catalogue:publish-file-and-skincare-products-v1'


def publish_retained_catalog(db):
    if db.get(StoreSnapshot,MARKER):return
    rows=db.scalars(select(Product).where(Product.active.is_(True)).order_by(Product.id).with_for_update()).unique().all()
    before=[];skipped=[]
    for product in rows:
        if product.category.name!='Bath & Skincare' and not is_uploaded(product):continue
        options=[v for v in product.variants if v.enabled and v.price>0]
        if not options:
            skipped.append(product.id);continue
        if product.sale_enabled and any(v.stock>0 for v in options):continue
        before.append({'id':product.id,'sale_enabled':product.sale_enabled,'version':product.version,
                       'variants':[{'id':v.id,'stock':v.stock} for v in product.variants]})
        if not any(v.stock>0 for v in options):options[0].stock=10
        product.sale_enabled=True;product.version+=1
    db.add(StoreSnapshot(id=MARKER,payload=gzip.compress(json.dumps({'products':before,'missing_prices':skipped}).encode())))
    if before:touch_catalog(db)
