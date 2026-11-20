"""Undo the cancelled media replacement without changing the store's commerce data."""
import gzip
import hashlib
import json
from pathlib import Path
from sqlalchemy import select
from .models import StoreDocument, StoreSnapshot
from .workspace import validate_document

SOURCE = 'storefront:owner-product-campaign-v1'
MARKER = 'storefront:undo-owner-product-campaign-v1'


def fingerprint(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode()).hexdigest()


def restore_previous_media(db, expected=None):
    if db.get(StoreSnapshot, MARKER):
        return
    snapshot = db.get(StoreSnapshot, SOURCE)
    if not snapshot:
        return
    previous = json.loads(gzip.decompress(snapshot.payload))
    if expected is None:
        expected = json.loads((Path(__file__).resolve().parents[1] / 'data' / 'campaign_undo.json').read_text())
    if set(previous) != set(expected) or set(previous) - {'hero', 'banners', 'fashion', 'videos'}:
        raise ValueError('The media recovery snapshot has unexpected sections.')
    documents = {row.key: row for row in db.scalars(
        select(StoreDocument).where(StoreDocument.key.in_(previous)).order_by(StoreDocument.key).with_for_update())}
    if db.get(StoreSnapshot, MARKER):
        return
    before = {}
    # Verify all four sections before restoring any, protecting intervening owner edits.
    for key, old in previous.items():
        row = documents.get(key)
        if not row or row.version != expected[key]['version'] or fingerprint(row.value) != expected[key]['sha256']:
            raise RuntimeError('Media changed after the cancelled update: ' + key)
        if old:
            validate_document(key, old['value'])
        before[key] = {'value': row.value, 'version': row.version}
    for key, old in previous.items():
        row = documents[key]
        if old is None:
            db.delete(row)
        else:
            row.value, row.version = old['value'], row.version + 1
    db.add(StoreSnapshot(id=MARKER, payload=gzip.compress(json.dumps({'source': SOURCE, 'before': before}).encode())))
