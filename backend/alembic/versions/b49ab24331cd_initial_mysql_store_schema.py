"""Initial MySQL store schema"""
from alembic import op
import sqlalchemy as sa

revision = 'b49ab24331cd'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('categories',
    sa.Column('id', sa.String(length=100), nullable=False),
    sa.Column('name', sa.String(length=100), nullable=False),
    sa.Column('delivery_fee', sa.Numeric(precision=12, scale=2), nullable=False),
    sa.CheckConstraint('delivery_fee >= 0'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('name')
    )
    op.create_table('customers',
    sa.Column('uid', sa.String(length=128, collation='utf8mb4_bin'), nullable=False),
    sa.Column('phone', sa.String(length=20), nullable=False),
    sa.Column('details', sa.JSON(), nullable=False),
    sa.Column('updated_at', sa.DateTime(), nullable=False),
    sa.PrimaryKeyConstraint('uid')
    )
    op.create_table('orders',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('customer_uid', sa.String(length=128, collation='utf8mb4_bin'), nullable=False),
    sa.Column('idempotency_key', sa.String(length=80, collation='utf8mb4_bin'), nullable=False),
    sa.Column('request_hash', sa.String(length=64), nullable=False),
    sa.Column('phone', sa.String(length=20), nullable=False),
    sa.Column('shipping', sa.JSON(), nullable=False),
    sa.Column('items', sa.JSON(), nullable=False),
    sa.Column('subtotal', sa.Numeric(precision=12, scale=2), nullable=False),
    sa.Column('delivery', sa.Numeric(precision=12, scale=2), nullable=False),
    sa.Column('delivery_breakdown', sa.JSON(), nullable=False),
    sa.Column('total', sa.Numeric(precision=12, scale=2), nullable=False),
    sa.Column('payment', sa.String(length=30), nullable=False),
    sa.Column('status', sa.String(length=40), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.Column('updated_at', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['customer_uid'], ['customers.uid'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('customer_uid', 'idempotency_key', name='uq_customer_request')
    )
    op.create_index(op.f('ix_orders_created_at'), 'orders', ['created_at'], unique=False)
    op.create_index(op.f('ix_orders_customer_uid'), 'orders', ['customer_uid'], unique=False)
    op.create_index(op.f('ix_orders_status'), 'orders', ['status'], unique=False)
    op.create_table('products',
    sa.Column('id', sa.String(length=191), nullable=False),
    sa.Column('name', sa.String(length=255), nullable=False),
    sa.Column('category_id', sa.String(length=100), nullable=False),
    sa.Column('description', sa.Text(), nullable=False),
    sa.Column('image', sa.Text(), nullable=False),
    sa.Column('active', sa.Boolean(), nullable=False),
    sa.Column('sale_enabled', sa.Boolean(), nullable=False),
    sa.Column('version', sa.Integer(), nullable=False),
    sa.Column('metadata_json', sa.JSON(), nullable=False),
    sa.ForeignKeyConstraint(['category_id'], ['categories.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_products_name'), 'products', ['name'], unique=False)
    op.create_table('order_events',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('order_id', sa.String(length=36), nullable=False),
    sa.Column('actor_uid', sa.String(length=128), nullable=False),
    sa.Column('status', sa.String(length=40), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['order_id'], ['orders.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_order_events_order_id'), 'order_events', ['order_id'], unique=False)
    op.create_table('variants',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('product_id', sa.String(length=191), nullable=False),
    sa.Column('label', sa.String(length=191), nullable=False),
    sa.Column('position', sa.Integer(), nullable=False),
    sa.Column('price', sa.Numeric(precision=12, scale=2), nullable=False),
    sa.Column('stock', sa.Integer(), nullable=False),
    sa.Column('enabled', sa.Boolean(), nullable=False),
    sa.CheckConstraint('price >= 0'),
    sa.CheckConstraint('stock >= 0'),
    sa.ForeignKeyConstraint(['product_id'], ['products.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_variants_product_id'), 'variants', ['product_id'], unique=False)


def downgrade():
    op.drop_index(op.f('ix_variants_product_id'), table_name='variants')
    op.drop_table('variants')
    op.drop_index(op.f('ix_order_events_order_id'), table_name='order_events')
    op.drop_table('order_events')
    op.drop_index(op.f('ix_products_name'), table_name='products')
    op.drop_table('products')
    op.drop_index(op.f('ix_orders_status'), table_name='orders')
    op.drop_index(op.f('ix_orders_customer_uid'), table_name='orders')
    op.drop_index(op.f('ix_orders_created_at'), table_name='orders')
    op.drop_table('orders')
    op.drop_table('customers')
    op.drop_table('categories')
