"""Add saved carts, opt-in preferences and a WhatsApp outbox; preserve existing data."""
import gzip
import json
from datetime import datetime, timezone
from alembic import op
import sqlalchemy as sa
revision='b3047ad21580'
down_revision='91c60af40e32'
branch_labels=None
depends_on=None


def upgrade():
    bind=op.get_bind();identifier='pre-carts-b3047ad21580'
    if not bind.execute(sa.text('SELECT id FROM store_snapshots WHERE id=:id'),{'id':identifier}).first():
        metadata=sa.MetaData();data={}
        for name in sa.inspect(bind).get_table_names():
            if name in {'alembic_version','store_snapshots'}:continue
            table=sa.Table(name,metadata,autoload_with=bind)
            data[name]=[dict(row) for row in bind.execute(sa.select(table)).mappings()]
        payload=gzip.compress(json.dumps({'format':'babyone-before-saved-carts-v1','tables':data},default=str).encode())
        bind.execute(sa.text('INSERT INTO store_snapshots (id,payload,created_at) VALUES (:id,:payload,:stamp)'),{'id':identifier,'payload':payload,'stamp':datetime.now(timezone.utc).replace(tzinfo=None)})
    from app.models import Base
    for name in ['customer_carts','whatsapp_preferences','whatsapp_messages']:
        Base.metadata.tables[name].create(bind,checkfirst=True)


def downgrade():
    raise RuntimeError('Export and review saved carts and message history before a manual downgrade.')
