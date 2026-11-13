"""Apply the owner's temporary flat delivery request once, retaining prior rules."""
import gzip
import json
import logging
from sqlalchemy import select
from .config import settings
from .models import StoreDocument, StoreSnapshot
from .shipping import ShippingConfig


def apply_flat_delivery(db):
    identifier = 'owner-flat-delivery-99-v1'
    if not settings().shipping_flat_99_once or db.get(StoreSnapshot, identifier):
        return
    row = db.scalar(select(StoreDocument).where(StoreDocument.key == 'shipping').with_for_update())
    if db.get(StoreSnapshot, identifier):
        db.rollback()
        return
    before = {'key': 'shipping', 'value': row.value, 'version': row.version} if row else None
    value = ShippingConfig.model_validate({**(row.value if row else {}),
        'pricing_mode': 'flat', 'flat_rate': '99.00', 'confirmed': True}).model_dump(mode='json')
    db.add(StoreSnapshot(id=identifier, payload=gzip.compress(json.dumps(before, default=str).encode())))
    if row:
        row.value, row.version = value, row.version + 1
    else:
        db.add(StoreDocument(key='shipping', value=value, version=1))
    db.commit()
    logging.getLogger(__name__).warning('Owner flat delivery enabled: INR 99 per order. Previous delivery settings retained in a private snapshot.')
