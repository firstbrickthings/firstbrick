"""Preserve history and pin every payment to its original gateway mode and key."""
import gzip
import json
from datetime import datetime, timezone
from alembic import op
import sqlalchemy as sa
revision='c4e8f071a213'
down_revision='b3047ad21580'
branch_labels=None
depends_on=None

def upgrade():
    bind=op.get_bind();identifier='pre-live-c4e8f071a213'
    if not bind.execute(sa.text('SELECT id FROM store_snapshots WHERE id=:id'),{'id':identifier}).first():
        metadata=sa.MetaData();data={}
        for name in sa.inspect(bind).get_table_names():
            if name in {'alembic_version','store_snapshots'}:continue
            table=sa.Table(name,metadata,autoload_with=bind)
            data[name]=[dict(row) for row in bind.execute(sa.select(table)).mappings()]
        payload=gzip.compress(json.dumps({'format':'babyone-before-live-payments-v1','tables':data},default=str).encode())
        bind.execute(sa.text('INSERT INTO store_snapshots (id,payload,created_at) VALUES (:id,:payload,:stamp)'),{'id':identifier,'payload':payload,'stamp':datetime.now(timezone.utc).replace(tzinfo=None)})
    columns={c['name'] for c in sa.inspect(bind).get_columns('payments')}
    if 'mode' not in columns:
        op.add_column('payments',sa.Column('mode',sa.String(8),nullable=False,server_default='test'))
        op.alter_column('payments','mode',server_default=None,existing_type=sa.String(8),existing_nullable=False)
    if 'key_id' not in columns:
        op.add_column('payments',sa.Column('key_id',sa.String(80),nullable=True))

def downgrade():
    raise RuntimeError('Review and export payment history before a manual downgrade.')
