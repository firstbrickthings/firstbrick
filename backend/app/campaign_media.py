"""Publish the approved campaign once, keeping the previous media for recovery."""
import gzip
import json
from pathlib import Path
from sqlalchemy import select
from .models import StoreDocument, StoreSnapshot
from .workspace import validate_document

MARKER = 'storefront:owner-product-campaign-v1'


def apply_campaign_media(db, manifest=None):
    if db.get(StoreSnapshot, MARKER):
        return
    if manifest is None:
        manifest = json.loads((Path(__file__).resolve().parents[1] / 'data' / 'campaign_media.json').read_text())
    keys = sorted(manifest['documents'])
    if set(keys) - {'hero', 'banners', 'fashion', 'videos'}:
        raise ValueError('Campaign updates may only change hero, banner and video documents.')
    documents = {row.key: row for row in db.scalars(
        select(StoreDocument).where(StoreDocument.key.in_(keys)).order_by(StoreDocument.key).with_for_update())}
    if db.get(StoreSnapshot, MARKER):
        return
    # Check every version and validate every replacement before changing any row.
    replacements = {}
    before = {}
    for key in keys:
        row = documents.get(key)
        entry = manifest['documents'][key]
        if (row.version if row else 0) != entry['expected_version']:
            raise RuntimeError('Campaign media changed during preparation: ' + key)
        replacements[key] = validate_document(key, entry['value'])
        before[key] = {'value': row.value, 'version': row.version} if row else None
    for key, value in replacements.items():
        row = documents.get(key)
        if row:
            row.value, row.version = value, row.version + 1
        else:
            db.add(StoreDocument(key=key, value=value, version=1))
    db.add(StoreSnapshot(id=MARKER, payload=gzip.compress(json.dumps(before).encode())))
