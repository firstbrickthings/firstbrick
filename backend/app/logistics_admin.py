"""Private cost records and order-time logistics reports; never public catalogue fields."""
import hashlib
from fastapi import APIRouter,Depends,HTTPException
from sqlalchemy.orm import Session
from .auth import Identity,admin
from .db import database
from .models import Order,StoreDocument
router=APIRouter(prefix='/api/admin')

def cost_key(product_id):return 'unit-cost:'+hashlib.sha256(product_id.encode()).hexdigest()

@router.get('/orders/{order_id}/logistics')
def order_report(order_id:str,user:Identity=Depends(admin),db:Session=Depends(database)):
    order=db.get(Order,order_id)
    if not order or order.kind!='purchase':raise HTTPException(404,'Order not found.')
    row=db.get(StoreDocument,'logistics-order:'+order_id)
    return {'order_id':order_id,'report':row.value if row else None,'version':row.version if row else 0,'message':'No policy evaluation was stored for this historical order. Its original payment and delivery totals are kept.' if not row else ''}


from decimal import Decimal
from pydantic import Field
from .schemas import Input,Money

class ActualCost(Input):
    expected_version:int=Field(ge=1)
    postage_gross:Money
    packaging:Money

@router.put('/orders/{order_id}/logistics/actual-cost')
def actual_cost(order_id:str,data:ActualCost,user:Identity=Depends(admin),db:Session=Depends(database)):
    from sqlalchemy import select
    from .logistics import cash
    row=db.scalar(select(StoreDocument).where(StoreDocument.key=='logistics-order:'+order_id).with_for_update())
    if not row:raise HTTPException(404,'No logistics report exists for this order.')
    if row.version!=data.expected_version:raise HTTPException(409,'Another session updated the report. Reload before saving.')
    report={**row.value};total=data.postage_gross+data.packaging
    report['actual_india_post_cost']={'postage_gross':cash(data.postage_gross),'packaging':cash(data.packaging),'total':cash(total),'recorded_by':user.uid}
    fee=Decimal(report['customer_shipping_fee']);report['actual_shipping_contribution']=cash(fee-total)
    if report.get('gross_product_margin') is not None:report['actual_margin_after_shipping_before_payment_fees']=cash(Decimal(report['gross_product_margin'])+fee-total)
    row.value=report;row.version+=1;db.commit()
    return {'order_id':order_id,'report':report,'version':row.version}
