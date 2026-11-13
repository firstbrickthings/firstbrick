"""One-time, owner-requested catalogue changes, backed by private row snapshots."""
import gzip,json,logging
from sqlalchemy import select
from .config import settings
from .models import Product,Variant,StoreSnapshot
from .services import touch_catalog

def apply_requested_setup(db):
    operations=[('stock-five-visible-20261113',settings().catalog_stock_five_once,'stock'),('price-ten-visible-20261113',settings().catalog_price_ten_once,'price'),('publish-reviewed-prices-20261113',settings().catalog_publish_prices_once,'publish')]
    for identifier,enabled,kind in operations:
        if not enabled or db.get(StoreSnapshot,identifier):continue
        products=db.scalars(select(Product).where(Product.active.is_(True)).order_by(Product.id).with_for_update()).unique().all()
        if db.get(StoreSnapshot,identifier):db.rollback();continue
        products=[p for p in products if not p.metadata_json.get('payment_test')]
        ids=[p.id for p in products]
        variants=db.scalars(select(Variant).where(Variant.product_id.in_(ids)).order_by(Variant.id).with_for_update()).all() if ids else []
        before={'format':'babyone-catalogue-change-v1','operation':kind,'products':[{'id':p.id,'active':p.active,'sale_enabled':p.sale_enabled,'version':p.version,'metadata':p.metadata_json} for p in products],
                'variants':[{'id':v.id,'product_id':v.product_id,'price':str(v.price),'stock':v.stock,'enabled':v.enabled} for v in variants]}
        db.add(StoreSnapshot(id=identifier,payload=gzip.compress(json.dumps(before,default=str).encode())))
        changed=set()
        if kind=='stock':
            for variant in variants:
                if variant.enabled:variant.stock=5;changed.add(variant.product_id)
        elif kind=='price':
            for variant in variants:
                if variant.enabled:variant.price=10;changed.add(variant.product_id)
        else:
            for product in products:
                options=[v for v in variants if v.product_id==product.id and v.enabled]
                if options and all(v.price>0 for v in options) and any(v.stock>0 for v in options):product.sale_enabled=True;changed.add(product.id)
        for product in products:
            if product.id in changed:product.version+=1
        touch_catalog(db);db.commit()
        logging.getLogger(__name__).warning('Owner catalogue setup completed: %s; %s products, %s enabled options. Private snapshot retained.',kind,len(changed),sum(v.enabled for v in variants))
