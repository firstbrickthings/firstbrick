"""email otp accounts and secure sessions"""
from alembic import op
import sqlalchemy as sa
import gzip,json
from datetime import datetime,timezone

revision = 'e51a682019c4'
down_revision = 'd8731f204ce9'
branch_labels = None
depends_on = None


def upgrade():
    bind=op.get_bind();identifier='pre-email-auth-e51a682019c4'
    if not bind.execute(sa.text('SELECT id FROM store_snapshots WHERE id=:id'),{'id':identifier}).first():
        metadata=sa.MetaData();data={}
        for name in sa.inspect(bind).get_table_names():
            if name in {'store_snapshots','alembic_version'}:continue
            table=sa.Table(name,metadata,autoload_with=bind)
            data[name]=[dict(row) for row in bind.execute(sa.select(table)).mappings()]
        payload=gzip.compress(json.dumps({'format':'babyone-before-email-auth-v1','tables':data},default=str).encode())
        bind.execute(sa.text('INSERT INTO store_snapshots (id,payload,created_at) VALUES (:id,:payload,:stamp)'),{'id':identifier,'payload':payload,'stamp':datetime.now(timezone.utc).replace(tzinfo=None)})
    op.create_table('auth_rate_limits',
    sa.Column('key', sa.String(length=64), nullable=False),
    sa.Column('window_at', sa.DateTime(), nullable=False),
    sa.Column('count', sa.Integer(), nullable=False),
    sa.Column('next_at', sa.DateTime(), nullable=False),
    sa.PrimaryKeyConstraint('key')
    )
    op.create_table('gmail_credentials',
    sa.Column('email', sa.String(length=254, collation='utf8mb4_bin'), nullable=False),
    sa.Column('encrypted_refresh_token', sa.Text(), nullable=False),
    sa.Column('google_subject', sa.String(length=128), nullable=False),
    sa.Column('connected_at', sa.DateTime(), nullable=False),
    sa.PrimaryKeyConstraint('email')
    )
    op.create_table('email_challenges',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('email', sa.String(length=254, collation='utf8mb4_bin'), nullable=False),
    sa.Column('code_digest', sa.String(length=64), nullable=False),
    sa.Column('device_digest', sa.String(length=64), nullable=False),
    sa.Column('link_uid', sa.String(length=128, collation='utf8mb4_bin'), nullable=True),
    sa.Column('verified_phone', sa.String(length=20), nullable=False),
    sa.Column('name', sa.String(length=100), nullable=False),
    sa.Column('contact_phone', sa.String(length=20), nullable=False),
    sa.Column('state', sa.String(length=20), nullable=False),
    sa.Column('attempts', sa.Integer(), nullable=False),
    sa.Column('expires_at', sa.DateTime(), nullable=False),
    sa.Column('consumed_at', sa.DateTime(), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['link_uid'], ['customers.uid'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_email_challenges_email'), 'email_challenges', ['email'], unique=False)
    op.create_index(op.f('ix_email_challenges_expires_at'), 'email_challenges', ['expires_at'], unique=False)
    op.create_table('email_identities',
    sa.Column('email', sa.String(length=254, collation='utf8mb4_bin'), nullable=False),
    sa.Column('customer_uid', sa.String(length=128, collation='utf8mb4_bin'), nullable=False),
    sa.Column('verified_phone', sa.String(length=20), nullable=False),
    sa.Column('verified_at', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['customer_uid'], ['customers.uid'], ),
    sa.PrimaryKeyConstraint('email'),
    sa.UniqueConstraint('customer_uid')
    )
    op.create_table('gmail_connect_states',
    sa.Column('state_digest', sa.String(length=64), nullable=False),
    sa.Column('device_digest', sa.String(length=64), nullable=False),
    sa.Column('owner_uid', sa.String(length=128, collation='utf8mb4_bin'), nullable=False),
    sa.Column('expires_at', sa.DateTime(), nullable=False),
    sa.Column('consumed_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['owner_uid'], ['customers.uid'], ),
    sa.PrimaryKeyConstraint('state_digest')
    )
    op.create_table('login_sessions',
    sa.Column('token_digest', sa.String(length=64), nullable=False),
    sa.Column('customer_uid', sa.String(length=128, collation='utf8mb4_bin'), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.Column('expires_at', sa.DateTime(), nullable=False),
    sa.Column('revoked_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['customer_uid'], ['customers.uid'], ),
    sa.PrimaryKeyConstraint('token_digest')
    )
    op.create_index(op.f('ix_login_sessions_customer_uid'), 'login_sessions', ['customer_uid'], unique=False)
    op.create_index(op.f('ix_login_sessions_expires_at'), 'login_sessions', ['expires_at'], unique=False)


def downgrade():
    raise RuntimeError('Review linked customer accounts and export authentication records before a manual downgrade.')
