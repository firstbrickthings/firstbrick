"""Owner-approved postal zones and measured individual or consolidated parcels.
No postcode distance or packaging measurement is invented at checkout.
"""
from decimal import Decimal, ROUND_CEILING
from fastapi import HTTPException
from pydantic import Field, model_validator
from .schemas import Input, Money
from .models import StoreDocument


class Parcel(Input):
    weight_kg: Decimal = Field(gt=0, le=35, decimal_places=3)
    length_cm: Decimal = Field(gt=0, le=150, decimal_places=1)
    width_cm: Decimal = Field(gt=0, le=150, decimal_places=1)
    height_cm: Decimal = Field(gt=0, le=150, decimal_places=1)
    bulky: bool = False

    @model_validator(mode='after')
    def postal_size(self):
        sides = sorted([self.length_cm, self.width_cm, self.height_cm])
        if sides[2] + 2 * (sides[0] + sides[1]) > 300:
            raise ValueError('This package requires a separately approved delivery quote.')
        return self


class Band(Input):
    up_to_kg: Decimal = Field(gt=0, le=35)
    price: Money


class Zone(Input):
    id: str = Field(pattern=r'^[a-z0-9_-]{1,40}$')
    name: str = Field(min_length=2, max_length=80)
    pin_prefixes: list[str] = Field(min_length=1, max_length=100)
    distance_km: Decimal | None = Field(default=None, ge=0, le=10000)
    bands: list[Band] = Field(min_length=1, max_length=20)
    extra_kg: Money = Decimal('0')
    max_kg: Decimal = Field(gt=0, le=35, default=35)

    @model_validator(mode='after')
    def rules(self):
        if any(not p.isdigit() or not 2 <= len(p) <= 6 or p[0] == '0' for p in self.pin_prefixes):
            raise ValueError('Use 2–6 digit postal PIN prefixes; use all six digits for one destination.')
        weights = [b.up_to_kg for b in self.bands]
        if weights != sorted(set(weights)):
            raise ValueError('Weight bands must be unique and increasing.')
        if [b.price for b in self.bands] != sorted(b.price for b in self.bands):
            raise ValueError('Postal prices must not decrease as weight increases.')
        if weights[-1] > self.max_kg:
            raise ValueError('The last weight band exceeds the zone parcel limit.')
        return self


class Carton(Parcel):
    id: str = Field(pattern=r'^[a-z0-9_-]{1,40}$')
    name: str = Field(min_length=2, max_length=80)
    product_ids: list[str] = Field(min_length=1,max_length=100)
    max_units: int = Field(ge=2,le=100,strict=True)
    max_weight_kg: Decimal = Field(gt=0,le=35)
    fit_confirmed: bool = False

    @model_validator(mode='after')
    def validate_carton(self):
        if any(not p or len(p)>191 for p in self.product_ids) or len(set(self.product_ids))!=len(self.product_ids):
            raise ValueError('Use unique existing product IDs.')
        if self.max_weight_kg<=self.weight_kg:
            raise ValueError('The maximum packed weight must exceed the empty carton weight.')
        return self


class ShippingConfig(Input):
    origin_pin: str = Field(default='673602', pattern=r'^[1-9][0-9]{5}$')
    confirmed: bool = False
    divisor: int = Field(default=5000, ge=1000, le=10000)
    packing_per_parcel: Money = Decimal('0')
    tax_percent: Decimal = Field(default=0, ge=0, le=100)
    cod_surcharge: Money = Decimal('0')
    cod_enabled: bool = False
    zones: list[Zone] = Field(default_factory=list, max_length=50)
    cartons: list[Carton] = Field(default_factory=list, max_length=20)

    @model_validator(mode='after')
    def unique_zones(self):
        ids = [z.id for z in self.zones]
        prefixes = [p for z in self.zones for p in z.pin_prefixes]
        if len(set(ids)) != len(ids) or len(prefixes) != len(set(prefixes)):
            raise ValueError('Zone IDs and PIN prefixes must be unique. More specific prefixes take priority.')
        if len({c.id for c in self.cartons})!=len(self.cartons):
            raise ValueError('Carton IDs must be unique.')
        if self.confirmed and not self.zones:
            raise ValueError('Add a verified postal zone before enabling checkout delivery.')
        return self


def configuration(db):
    row = db.get(StoreDocument, 'shipping')
    return ShippingConfig.model_validate(row.value) if row else ShippingConfig()


def delivery_quote(db, products, quantities, variants, pin='', payment='RAZORPAY'):
    if products and all(p.metadata_json.get('payment_test') for p in products.values()):
        return Decimal('0'), [{'category': 'Test payment — no delivery', 'rate': '0.00'}], False
    if not pin:
        return Decimal('0'), [], True
    config = configuration(db)
    if not config.confirmed:
        raise HTTPException(409, 'Delivery rates are being confirmed. Contact BabyOne with your PIN for a delivery quote. Your bag is kept.')
    matches = [(len(prefix), zone) for zone in config.zones for prefix in zone.pin_prefixes if pin.startswith(prefix)]
    if not matches:
        raise HTTPException(409, 'Please request a delivery quote for this PIN. Your bag is kept.')
    zone = max(matches, key=lambda item: item[0])[1]
    if payment == 'COD' and not config.cod_enabled:
        raise HTTPException(409, 'Cash on delivery is unavailable for this rate card. Choose a prepaid payment.')
    total, breakdown = Decimal('0'), []
    for name, qty, parcel in packed_parcels(config, products, quantities, variants):
        volumetric = parcel.length_cm * parcel.width_cm * parcel.height_cm / config.divisor
        chargeable = max(parcel.weight_kg, volumetric)
        if chargeable > zone.max_kg:
            raise HTTPException(409, f'{name} needs a separate bulky-item delivery quote.')
        band = next((b for b in zone.bands if chargeable <= b.up_to_kg), None)
        billed = band.up_to_kg if band else zone.bands[-1].up_to_kg + (chargeable-zone.bands[-1].up_to_kg).to_integral_value(rounding=ROUND_CEILING)
        if billed > zone.max_kg:
            raise HTTPException(409, 'This parcel exceeds the approved weight limit. Contact the store for a quote.')
        postage = band.price if band else zone.bands[-1].price + (billed-zone.bands[-1].up_to_kg)*zone.extra_kg
        if not band and zone.extra_kg <= 0:
            raise HTTPException(409, 'A heavier parcel needs an approved delivery quote.')
        cost = ((postage + config.packing_per_parcel) * (1+config.tax_percent/100)).quantize(Decimal('0.01'))
        rate = cost * qty
        total += rate
        breakdown.append({'category': name, 'zone': zone.name, 'origin_pin': config.origin_pin,
                          'destination_pin': pin, 'parcels': qty, 'actual_kg': str(parcel.weight_kg),
                          'volumetric_kg': str(volumetric.quantize(Decimal('0.001'))), 'billed_kg': str(billed),
                          'distance_km': str(zone.distance_km) if zone.distance_km is not None else None,
                          'rate': str(rate)})
    if payment == 'COD' and config.cod_surcharge:
        total += config.cod_surcharge
        breakdown.append({'category': 'Cash on delivery handling', 'rate': str(config.cod_surcharge)})
    return total, breakdown, False


def packed_parcels(config, products, quantities, variants):
    remaining={}
    specs={}
    for variant_id,quantity in quantities.items():
        pid=variants[variant_id].product_id
        remaining[pid]=remaining.get(pid,0)+quantity
        raw=products[pid].metadata_json.get('shipping')
        if not raw:
            raise HTTPException(409,f'Packed measurements are needed for {products[pid].name}. Contact BabyOne for a delivery quote.')
        try:specs[pid]=Parcel.model_validate(raw)
        except ValueError:raise HTTPException(409,'A product needs reviewed packed measurements. Contact BabyOne for a quote.') from None
    result=[]
    for carton in config.cartons:
        if not carton.fit_confirmed:continue
        box_sides=sorted([carton.length_cm,carton.width_cm,carton.height_cm])
        box_volume=carton.length_cm*carton.width_cm*carton.height_cm
        while True:
            used,weight,volume=0,carton.weight_kg,Decimal('0')
            contents={}
            for pid in sorted(remaining):
                parcel=specs[pid]
                sides=sorted([parcel.length_cm,parcel.width_cm,parcel.height_cm])
                if pid not in carton.product_ids or parcel.bulky or any(a>b for a,b in zip(sides,box_sides)):continue
                unit_volume=parcel.length_cm*parcel.width_cm*parcel.height_cm
                while remaining[pid] and used<carton.max_units and weight+parcel.weight_kg<=carton.max_weight_kg and volume+unit_volume<=box_volume:
                    contents[pid]=contents.get(pid,0)+1;remaining[pid]-=1
                    used+=1;weight+=parcel.weight_kg;volume+=unit_volume
            if not used:break
            parcel=Parcel(weight_kg=weight,length_cm=carton.length_cm,width_cm=carton.width_cm,height_cm=carton.height_cm)
            result.append((carton.name+' ('+str(used)+' items)',1,parcel))
    for pid,qty in remaining.items():
        if qty:result.append((products[pid].name,qty,specs[pid]))
    return result
