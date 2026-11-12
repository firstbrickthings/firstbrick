"""Validated bulk catalogue operations; preserve historical variants and order totals."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import Field
from sqlalchemy import select
from sqlalchemy.orm import Session
from typing import Literal
from .auth import Identity, admin
from .db import database
from .models import Product, Variant
from .schemas import Input
from .services import touch_catalog
router=APIRouter(prefix='/api/admin')


class Selection(Input):
    id: str = Field(min_length=1,max_length=191)
    version: int = Field(ge=1)


class BulkInput(Input):
    products: list[Selection] = Field(min_length=1,max_length=100)
    action: Literal['set_stock','add_stock','subtract_stock','hide','show']
    quantity: int = Field(default=0,ge=0,le=10000000,strict=True)


@router.post('/products/bulk')
def bulk(data:BulkInput,user:Identity=Depends(admin),db:Session=Depends(database)):
    ids=sorted(p.id for p in data.products)
    if len(ids)!=len(set(ids)):raise HTTPException(422,'Select each product once.')
    records=db.scalars(select(Product).where(Product.id.in_(ids)).order_by(Product.id).with_for_update()).unique().all()
    versions={p.id:p.version for p in data.products}
    if len(records)!=len(ids) or any(p.version!=versions[p.id] for p in records):raise HTTPException(409,'Selected products changed. Reload before applying a bulk edit.')
    variants=db.scalars(select(Variant).where(Variant.product_id.in_(ids),Variant.enabled.is_(True)).order_by(Variant.id).with_for_update()).all()
    for p in records:
        if data.action in {'hide','show'}:p.active=data.action=='show'
        p.version+=1
    for v in variants:
        if data.action=='set_stock':v.stock=data.quantity
        elif data.action=='add_stock':v.stock+=data.quantity
        elif data.action=='subtract_stock':
            if v.stock<data.quantity:raise HTTPException(409,'A selected option has fewer units than the requested subtraction. No changes were saved.')
            v.stock-=data.quantity
        if v.stock>10000000:raise HTTPException(422,'The resulting stock exceeds the supported limit.')
    touch_catalog(db);db.commit();return {'updated':len(records)}
