"""Owner-defined checkout policy and private, explicitly estimated postal evaluations."""
from decimal import Decimal,ROUND_CEILING
from pydantic import Field,model_validator
from fastapi import HTTPException
from .schemas import Input,Money

D=Decimal

def cash(value):return str(D(value).quantize(D('.01')))

class ReferenceBand(Input):
    up_to_kg:Decimal=Field(gt=0,le=35)
    gross_low:Money
    gross_high:Money
    packaging_included:Money=D('0')
    @model_validator(mode='after')
    def valid(self):
        if self.gross_high<self.gross_low or self.packaging_included>self.gross_low:raise ValueError('Check the inclusive reference cost range.')
        return self

class LogisticsPolicy(Input):
    free_threshold:Money=D('599')
    standard_fee:Money=D('60')
    bulky_fee:Money=D('199')
    light_kg:Decimal=Field(default=D('.4'),gt=0,le=35,decimal_places=3)
    medium_kg:Decimal=Field(default=D('1.2'),gt=0,le=35,decimal_places=3)
    bulky_kg:Decimal=Field(default=D('5'),gt=0,le=35,decimal_places=3)
    mailer_cost:Money=D('20')
    box_cost:Money=D('40')
    carton_cost:Money=D('120')
    gst_percent:Decimal=Field(default=D('18'),ge=0,le=100)
    extra_kg_gross:Money=D('100')
    references:list[ReferenceBand]=Field(default_factory=lambda:[ReferenceBand(up_to_kg='.5',gross_low='55',gross_high='95'),ReferenceBand(up_to_kg='1.5',gross_low='105',gross_high='190'),ReferenceBand(up_to_kg='3',gross_low='210',gross_high='320'),ReferenceBand(up_to_kg='5',gross_low='600',gross_high='710',packaging_included='120')],min_length=1,max_length=20)
    @model_validator(mode='after')
    def increasing(self):
        weights=[r.up_to_kg for r in self.references]
        if weights!=sorted(set(weights)):raise ValueError('Reference weights must be unique and increasing.')
        return self


def product_tier(product):
    meta=product.metadata_json or {};override=meta.get('logistics',{}).get('tier')
    if override in (1,2,3):return override
    text=' '.join([product.name,str(meta.get('subcategory','')),str(getattr(getattr(product,'category',None),'name',''))]).lower()
    # Physical product types take priority over broad parent categories.
    if any(word in text for word in ['ride-on','ride on','stroller','pram','cradle','rocker','rocking chair','electric swing','swing car','crib','cot bed','wardrobe','cabinet','high chair','car seat','bath tub','bathtub','bouncer','walker','tricycle','skating ride','cycle']):return 3
    if any(word in text for word in ['toy','sterilizer','bottle warmer','food container','potty']):return 2
    if any(word in text for word in ['feeding cover','burp cloth','bib','romper','bodysuit','body suit','jhabla','jabala','jabla','swaddle','sleep suit','sleepsuit','dry sheet','cotton','nursing bra','maternity pad','skincare','skin care','lotion','diaper','wipe']):return 1
    cat=str(getattr(getattr(product,'category',None),'name','')).lower()
    if cat in ['clothing','new born','newborn','bath & skincare','diapering']:return 1
    if cat=='ride-on' or cat=='cradles & rockers':return 3
    if cat=='mom care' and any(w in text for w in ['wear','bra','pad','oil','postpartum']):return 1
    return 2


def customer_fee(policy,tiers,subtotal,payment,cod_enabled):
    bulky=3 in tiers
    if payment=='COD' and (bulky or not cod_enabled):raise HTTPException(409,'Choose a prepaid payment. Cash on delivery is unavailable for this order.')
    fee=policy.bulky_fee if bulky else D('0') if subtotal>=policy.free_threshold else policy.standard_fee
    name='Oversized handling' if bulky else 'Free standard delivery' if fee==0 else 'Standard delivery'
    return fee,{'category':name,'mode':'policy','rate':cash(fee),'bulky':bulky,'cod_allowed':cod_enabled and not bulky,'free_threshold':cash(policy.free_threshold)}


def parcel_estimate(policy,weight,packaging):
    if weight>35:raise HTTPException(409,'This parcel needs a separate delivery quote because it exceeds 35 kg. Your bag is kept.')
    band=next((b for b in policy.references if weight<=b.up_to_kg),policy.references[-1])
    extra=max(D('0'),weight-band.up_to_kg).to_integral_value(rounding=ROUND_CEILING)*policy.extra_kg_gross
    # Supplied ranges already include GST; the 5 kg reference also includes its box.
    gross_low=band.gross_low-band.packaging_included+extra;gross_high=band.gross_high-band.packaging_included+extra
    divisor=1+policy.gst_percent/100
    return {'weight_kg':str(weight),'base_low':cash(gross_low/divisor),'base_high':cash(gross_high/divisor),
        'gst_low':cash(gross_low-gross_low/divisor),'gst_high':cash(gross_high-gross_high/divisor),
        'packaging':cash(packaging),'total_low':cash(gross_low+packaging),'total_high':cash(gross_high+packaging)}


def evaluate(policy,products,quantities,variants,pin,subtotal,cod_enabled=False,payment='RAZORPAY',state='',unit_costs=None,origin_pin='673602'):
    lines=[];parcels=[];soft_weight=D('0');soft_has_medium=False;soft_measured=True;missing_dimensions=[];product_cost=D('0');cost_known=True
    for vid,qty in quantities.items():
        variant=variants[vid];product=products[variant.product_id];tier=product_tier(product);meta=product.metadata_json or {};spec=meta.get('shipping') or {};logistic=meta.get('logistics') or {}
        exact=spec.get('weight_kg') or logistic.get('weight_kg');weight=D(str(exact)) if exact else {1:policy.light_kg,2:policy.medium_kg,3:policy.bulky_kg}[tier]
        if weight<=0 or weight>35:raise HTTPException(409,'A product requires a separate postal delivery quote.')
        dimensions=[spec.get(k) for k in ['length_cm','width_cm','height_cm']]
        if all(dimensions):
            sides=sorted(D(str(s)) for s in dimensions)
            if sides[-1]>150 or sides[-1]+2*(sides[0]+sides[1])>300:raise HTTPException(409,'This product exceeds the India Post parcel size limits. Contact the store for a separate quote.')
        elif tier==3:missing_dimensions.append(product.id)
        lines.append({'product_id':product.id,'variant_id':vid,'name':product.name,'quantity':qty,'option':getattr(variant,'label',''),'tier':tier,'unit_weight_kg':str(weight),'total_weight_kg':str(weight*qty),'weight_source':'measured' if exact else 'owner_default'})
        if tier==3:
            parcels.extend([parcel_estimate(policy,weight,policy.carton_cost) for _ in range(qty)])
        else:soft_weight+=weight*qty;soft_has_medium|=tier==2;soft_measured&=bool(exact)
        unit=(unit_costs or {}).get(product.id)
        if unit is None:cost_known=False
        else:product_cost+=D(str(unit))*qty
    if soft_weight:parcels.insert(0,parcel_estimate(policy,soft_weight,policy.box_cost if soft_has_medium or soft_weight>D('1.5') else policy.mailer_cost))
    fee,public=customer_fee(policy,[l['tier'] for l in lines],subtotal,payment,cod_enabled)
    low=sum((D(p['total_low']) for p in parcels),D('0'));high=sum((D(p['total_high']) for p in parcels),D('0'))
    # Only explicitly known PINs are inferred offline; other states come from the order address.
    destination='Local dispatch PIN' if pin==origin_pin else 'Intrastate / Kerala' if pin=='673661' or state.strip().lower()=='kerala' else 'Interstate / Other States' if state else 'Destination state awaiting address confirmation'
    instructions=['Consolidate Tier 1/2 products in one box when postal size and weight limits allow. Use a sealed poly-bag inner lining to protect soft goods and liquids.']
    if 3 in [l['tier'] for l in lines]:instructions.append('Pack each oversized unit in a heavy-duty corrugated carton with edge protection. Use flat-pack / knockdown packaging where the manufacturer permits. Measure every finished carton before booking; length ≤ 150 cm and length + girth ≤ 300 cm.')
    if missing_dimensions:instructions.append('Oversized parcel measurements are missing. Confirm packed dimensions and postal acceptance before dispatch.')
    if any(l['weight_source']=='owner_default' for l in lines):instructions.append('Default weights are estimates. Weigh the finished parcel, including packaging, before booking postage.')
    report={'cost_basis':'owner_reference_estimate','gst_percent':str(policy.gst_percent),'service':'India Post Registered Parcel' if 3 in [l['tier'] for l in lines] else 'India Post Standard Parcel','actual_india_post_cost':None,'origin_pin':origin_pin,'destination_pin':pin,'destination_zone':destination,'destination_zone_basis':'customer address / known store PIN' if state or pin in [origin_pin,'673661'] else 'unconfirmed',
        'lines':lines,'total_weight_kg':str(sum((D(l['total_weight_kg']) for l in lines),D('0'))),'parcels':parcels,
        'estimated_cost':{'low':cash(low),'high':cash(high)},'customer_shipping_fee':cash(fee),'shipping_subsidy':{'low':cash(low-fee),'high':cash(high-fee)},
        'gross_product_margin':cash(subtotal-product_cost) if cost_known else None,
        'margin_after_shipping_before_payment_fees':{'low':cash(subtotal-product_cost+fee-high),'high':cash(subtotal-product_cost+fee-low)} if cost_known else None,
        'profit_review':'product costs required' if not cost_known else 'shortfall' if subtotal-product_cost+fee-high<0 else 'covered before payment fees',
        'missing_dimensions':sorted(set(missing_dimensions)),'instructions':instructions,
        'note':'Postal ranges are estimates supplied by the store, not verified India Post quotes. GST is not added twice; embedded box cost is removed before the actual packaging allowance is added. Finished packaging weight and volumetric billing still need confirmation.'}
    return fee,public,report
