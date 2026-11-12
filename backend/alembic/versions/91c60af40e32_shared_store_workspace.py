"""Add shared publishing, measured traffic and reporting without replacing records."""
import gzip
import json
from datetime import datetime, timezone
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

revision='91c60af40e32'
down_revision='2e9a2262151d'
branch_labels=None
depends_on=None


def upgrade():
    bind=op.get_bind()
    inspector=sa.inspect(bind)
    existing=set(inspector.get_table_names())
    # A private rollback copy before touching existing schema. No keys/tokens are stored in these tables.
    if 'store_snapshots' not in existing:
        op.create_table('store_snapshots',sa.Column('id',sa.String(80),primary_key=True),
                        sa.Column('payload',mysql.LONGBLOB(),nullable=False),sa.Column('created_at',sa.DateTime(),nullable=False))
    identifier='pre-workspace-91c60af40e32'
    if not bind.execute(sa.text('SELECT id FROM store_snapshots WHERE id=:id'),{'id':identifier}).first():
        data={}
        metadata=sa.MetaData()
        for name in sorted(existing-{'alembic_version','store_snapshots'}):
            table=sa.Table(name,metadata,autoload_with=bind)
            data[name]=[dict(row) for row in bind.execute(sa.select(table)).mappings()]
        stamp=datetime.now(timezone.utc).replace(tzinfo=None)
        payload=gzip.compress(json.dumps({'format':'babyone-pre-workspace-v1','tables':data},default=str).encode())
        bind.execute(sa.text('INSERT INTO store_snapshots (id,payload,created_at) VALUES (:id,:payload,:stamp)'),{'id':identifier,'payload':payload,'stamp':stamp})
        # The following MySQL DDL commits the snapshot before applying the schema change.
    if 'first_verified_at' not in {col['name'] for col in inspector.get_columns('customers')}:
        op.add_column('customers',sa.Column('first_verified_at',sa.DateTime(),nullable=True))
    # New tables only; never create_all over existing store records or seed fabricated history.
    from app.models import Base
    for name in ['store_documents','site_reviews','visit_sessions','media_files','reporting_events']:
        Base.metadata.tables[name].create(bind,checkfirst=True)


def downgrade():
    # An automatic rollback must not destroy newly created customer content or history.
    raise RuntimeError('Export and review shared content before a manual schema downgrade.')
