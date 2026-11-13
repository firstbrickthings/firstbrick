"""Separate owner payment checks from purchase/fulfilment records."""
import gzip,json
from datetime import datetime,timezone
from alembic import op
import sqlalchemy as sa
revision='d8731f204ce9'
down_revision='c4e8f071a213'
branch_labels=None
depends_on=None

def upgrade():
    bind=op.get_bind();identifier='pre-checks-d8731f204ce9'
    if not bind.execute(sa.text('SELECT id FROM store_snapshots WHERE id=:id'),{'id':identifier}).first():
        metadata=sa.MetaData();data={}
        for name in sa.inspect(bind).get_table_names():
            if name in {'alembic_version','store_snapshots'}:continue
            table=sa.Table(name,metadata,autoload_with=bind)
            data[name]=[dict(row) for row in bind.execute(sa.select(table)).mappings()]
        payload=gzip.compress(json.dumps({'format':'babyone-before-owner-check-v1','tables':data},default=str).encode())
        bind.execute(sa.text('INSERT INTO store_snapshots (id,payload,created_at) VALUES (:id,:payload,:stamp)'),{'id':identifier,'payload':payload,'stamp':datetime.now(timezone.utc).replace(tzinfo=None)})
    if 'kind' not in {c['name'] for c in sa.inspect(bind).get_columns('orders')}:
        op.add_column('orders',sa.Column('kind',sa.String(30),nullable=False,server_default='purchase'))

def downgrade():
    raise RuntimeError('Review payment-check history before a manual downgrade.')
