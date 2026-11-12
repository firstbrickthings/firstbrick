from datetime import datetime, timezone
from decimal import Decimal
from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Integer, JSON, LargeBinary, Numeric, String, Text, UniqueConstraint
from sqlalchemy.dialects.mysql import LONGBLOB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


def now():
    return datetime.now(timezone.utc).replace(tzinfo=None)


class Base(DeclarativeBase):
    pass


class Category(Base):
    __tablename__ = 'categories'
    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True)
    delivery_fee: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal('60.00'))
    __table_args__ = (CheckConstraint('delivery_fee >= 0'),)


class Product(Base):
    __tablename__ = 'products'
    id: Mapped[str] = mapped_column(String(191), primary_key=True)
    name: Mapped[str] = mapped_column(String(255), index=True)
    category_id: Mapped[str] = mapped_column(ForeignKey('categories.id'))
    description: Mapped[str] = mapped_column(Text, default='')
    image: Mapped[str] = mapped_column(Text, default='')
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    sale_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    version: Mapped[int] = mapped_column(Integer, default=1)
    metadata_json: Mapped[dict] = mapped_column(JSON, default=dict)
    category: Mapped[Category] = relationship(lazy='joined')
    variants: Mapped[list['Variant']] = relationship(back_populates='product', lazy='selectin', order_by='Variant.position')


class Variant(Base):
    __tablename__ = 'variants'
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    product_id: Mapped[str] = mapped_column(ForeignKey('products.id'), index=True)
    label: Mapped[str] = mapped_column(String(191), default='')
    position: Mapped[int] = mapped_column(Integer, default=0)
    price: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    stock: Mapped[int] = mapped_column(Integer, default=0)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    product: Mapped[Product] = relationship(back_populates='variants')
    __table_args__ = (CheckConstraint('stock >= 0'), CheckConstraint('price >= 0'))


class Customer(Base):
    __tablename__ = 'customers'
    uid: Mapped[str] = mapped_column(String(128, collation="utf8mb4_bin"), primary_key=True)
    phone: Mapped[str] = mapped_column(String(20))
    details: Mapped[dict] = mapped_column(JSON, default=dict)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=now, onupdate=now)
    first_verified_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class Order(Base):
    __tablename__ = 'orders'
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    customer_uid: Mapped[str] = mapped_column(ForeignKey('customers.uid'), index=True)
    idempotency_key: Mapped[str] = mapped_column(String(80, collation="utf8mb4_bin"))
    request_hash: Mapped[str] = mapped_column(String(64))
    phone: Mapped[str] = mapped_column(String(20))
    shipping: Mapped[dict] = mapped_column(JSON)
    items: Mapped[list] = mapped_column(JSON)
    subtotal: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    delivery: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    delivery_breakdown: Mapped[list] = mapped_column(JSON)
    total: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    payment: Mapped[str] = mapped_column(String(30), default='COD')
    status: Mapped[str] = mapped_column(String(40), default='Order Confirmed', index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=now, onupdate=now)
    payment_record: Mapped['Payment | None'] = relationship('Payment', uselist=False, lazy='selectin')
    __table_args__ = (UniqueConstraint('customer_uid', 'idempotency_key', name='uq_customer_request'),)


class OrderEvent(Base):
    __tablename__ = 'order_events'
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    order_id: Mapped[str] = mapped_column(ForeignKey('orders.id'), index=True)
    actor_uid: Mapped[str] = mapped_column(String(128))
    status: Mapped[str] = mapped_column(String(40))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)


class Payment(Base):
    __tablename__ = 'payments'
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    order_id: Mapped[str] = mapped_column(ForeignKey('orders.id'), unique=True)
    provider_order_id: Mapped[str | None] = mapped_column(String(64), unique=True, nullable=True)
    provider_payment_id: Mapped[str | None] = mapped_column(String(64), unique=True, nullable=True)
    amount_paise: Mapped[int] = mapped_column(Integer)
    currency: Mapped[str] = mapped_column(String(3), default='INR')
    status: Mapped[str] = mapped_column(String(30), default='pending')
    create_attempted: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=now, onupdate=now)


class PaymentEvent(Base):
    __tablename__ = 'payment_events'
    event_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    event_type: Mapped[str] = mapped_column(String(50))
    provider_payment_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)


class StoreDocument(Base):
    __tablename__ = 'store_documents'
    key: Mapped[str] = mapped_column(String(100), primary_key=True)
    value: Mapped[dict] = mapped_column(JSON)
    version: Mapped[int] = mapped_column(Integer, default=1)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=now, onupdate=now)


class SiteReview(Base):
    __tablename__ = 'site_reviews'
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    message: Mapped[str] = mapped_column(Text)
    rating: Mapped[int] = mapped_column(Integer)
    published: Mapped[bool] = mapped_column(Boolean, default=False)
    position: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=now, onupdate=now)
    __table_args__ = (CheckConstraint('rating >= 1 AND rating <= 5'),)


class VisitSession(Base):
    __tablename__ = 'visit_sessions'
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    source: Mapped[str] = mapped_column(String(100), default='Direct / Unknown')
    first_seen: Mapped[datetime] = mapped_column(DateTime, default=now, index=True)
    last_seen: Mapped[datetime] = mapped_column(DateTime, default=now, index=True)


class MediaFile(Base):
    __tablename__ = 'media_files'
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    object_key: Mapped[str] = mapped_column(String(200))
    content_type: Mapped[str] = mapped_column(String(100))
    size: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)


class ReportingEvent(Base):
    __tablename__ = 'reporting_events'
    id: Mapped[str] = mapped_column(String(80), primary_key=True)
    kind: Mapped[str] = mapped_column(String(50))
    payload: Mapped[dict] = mapped_column(JSON)
    status: Mapped[str] = mapped_column(String(20), default='pending', index=True)
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    last_error: Mapped[str] = mapped_column(String(150), default='')
    next_attempt: Mapped[datetime] = mapped_column(DateTime, default=now, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)


class StoreSnapshot(Base):
    __tablename__ = 'store_snapshots'
    id: Mapped[str] = mapped_column(String(80), primary_key=True)
    payload: Mapped[bytes] = mapped_column(LargeBinary().with_variant(LONGBLOB(), 'mysql'))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)
