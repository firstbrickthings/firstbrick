from decimal import Decimal
from typing import Annotated, Literal
from pydantic import BaseModel, ConfigDict, Field, field_validator

Money = Annotated[Decimal, Field(ge=0, le=9999999, max_digits=12, decimal_places=2)]


class Input(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True, validate_default=True)


class CartItem(Input):
    variant_id: str = Field(min_length=1, max_length=36)
    quantity: int = Field(ge=1, le=100, strict=True)
    pattern_id: str | None = Field(default=None, max_length=50)


class QuoteInput(Input):
    items: list[CartItem] = Field(min_length=1, max_length=50)
    pin: str = Field(default='', pattern=r'^$|^[1-9][0-9]{5}$')
    payment: Literal['COD', 'RAZORPAY'] = 'RAZORPAY'


class Shipping(Input):
    name: str = Field(min_length=2, max_length=100)
    address: str = Field(min_length=5, max_length=500)
    city: str = Field(min_length=2, max_length=100)
    state: str = Field(min_length=2, max_length=100)
    pin: str = Field(pattern=r'^[1-9][0-9]{5}$')
    email: str = Field(default='', max_length=254)

    @field_validator('email')
    @classmethod
    def email_format(cls, value):
        if value and ('@' not in value or '.' not in value.rsplit('@', 1)[-1]):
            raise ValueError('Enter a valid email address.')
        return value


class OrderInput(QuoteInput):
    idempotency_key: str = Field(pattern=r'^[A-Za-z0-9_-]{8,80}$')
    quote_hash: str = Field(pattern=r'^[a-f0-9]{64}$')
    shipping: Shipping
    payment: Literal['COD', 'RAZORPAY'] = 'COD'


class VariantInput(Input):
    id: str | None = Field(default=None, max_length=36)
    label: str = Field(default='', max_length=191)
    price: Money
    stock: int = Field(ge=0, le=10000000, strict=True)
    enabled: bool = True


class PatternInput(Input):
    id: str = Field(min_length=1, max_length=50)
    name: str = Field(min_length=1, max_length=100)
    available: bool = True
    photo: str = Field(default='', max_length=2000)

    @field_validator('photo')
    @classmethod
    def safe_photo(cls,value):
        from .workspace import safe_url
        if value and not safe_url(value):raise ValueError('Use a valid website image.')
        return value


class ProductInput(Input):
    name: str = Field(min_length=2, max_length=255)
    category_id: str = Field(min_length=1, max_length=100)
    description: str = Field(default='', max_length=10000)
    image: str = Field(default='', max_length=2000)
    active: bool = True
    sale_enabled: bool = False
    variants: list[VariantInput] = Field(min_length=1, max_length=100)
    patterns: list[PatternInput] = Field(default_factory=list, max_length=50)
    expected_version: int | None = Field(default=None, ge=1)
    shipping: dict | None = None
    brand: str | None = Field(default=None,max_length=100)
    sku: str | None = Field(default=None,max_length=100)
    subcategory: str | None = Field(default=None,max_length=100)
    badge: str | None = Field(default=None,max_length=100)
    gallery_images: list[str] | None = Field(default=None,max_length=50)

    @field_validator('gallery_images')
    @classmethod
    def safe_gallery(cls,value):
        from .workspace import safe_url
        if value is not None and any(not safe_url(v) for v in value):
            raise ValueError('Use valid uploaded website images.')
        return value

    @field_validator('shipping')
    @classmethod
    def parcel(cls, value):
        if value is not None:
            from .shipping import Parcel
            return Parcel.model_validate(value).model_dump(mode='json')
        return None

    @field_validator('image')
    @classmethod
    def image_url(cls, value):
        from .workspace import safe_url
        if value and not safe_url(value):
            raise ValueError('Use an HTTPS image URL or a local assets/ path.')
        return value


class CategoryInput(Input):
    name: str = Field(min_length=2, max_length=100)
    delivery_fee: Money


class StatusInput(Input):
    status: Literal['Order Confirmed', 'Packed', 'Shipped', 'Out for Delivery', 'Delivered', 'Cancelled']


class PaymentVerification(Input):
    razorpay_order_id: str = Field(pattern=r'^order_[A-Za-z0-9]+$', max_length=64)
    razorpay_payment_id: str = Field(pattern=r'^pay_[A-Za-z0-9]+$', max_length=64)
    razorpay_signature: str = Field(pattern=r'^[a-f0-9]{64}$')
