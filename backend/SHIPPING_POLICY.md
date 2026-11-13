# Store delivery policy

Checkout supports the owner's tier policy alongside the retained flat-rate and measured postal-zone modes. Dashboard → Delivery charges edits the active mode, fees, default weights, packaging allowances and reference cost ranges.

## Customer fees

- Tier 1/2-only cart below INR 599 in product subtotal: INR 60 standard delivery.
- Tier 1/2-only cart from INR 599: free standard delivery.
- Any Tier 3 item: INR 199 oversized handling for the entire order, including mixed carts. This is editable; free shipping never overrides it.
- Tier 3 orders require prepaid payment. The optional INR 200 advance/COD route is not used.
- Other COD orders follow the owner's existing COD setting. The customer payment panel omits COD when it is unavailable.

Existing selling prices, inventory and historical order bills are preserved. A single product currently priced at INR 10 has a new policy total of INR 70. A saved order created under older delivery rules keeps its original bill; its original total must be reviewed again if it differs before payment is opened.

## Classification and weights

The defaults supplied by the owner are 0.4 kg for light soft goods, 1.2 kg for medium accessories and 5 kg for oversized gear. Product-type matching takes precedence over a broad category: for example, a bathtub or high chair does not inherit a light skincare/feeding category weight. The owner can override the logistics tier and enter measured weight in the product editor. Measured packed weight takes priority over the fallback weight. Default values are labelled estimates.

Ten rompers using the default are 4 kg, before unmeasured outer packaging. They are not assumed to weigh 1.5 kg. Tier 1/2 items consolidate into one parcel when within postal limits; carts over 35 kg need a separately reviewed delivery arrangement. Oversized units are packed separately. Known measurements are checked against length ≤ 150 cm and length + girth ≤ 300 cm. Missing oversized packed dimensions prevent marking the order Shipped until the owner supplies valid packing measurements.

## Estimates and actual expenses

The owner's approximate postal reference ranges are GST-inclusive. The 5 kg range also includes an INR 120 box. The evaluator removes that embedded box allowance before adding the actual chosen packaging allowance, and does not add GST a second time. The unspecified 3–4 kg interval uses the next 5 kg band conservatively. Whole kilograms above the last reference band add the configured GST-inclusive reference amount.

The reference ranges are not verified India Post quotes. Finished packing weight and volumetric billing still require confirmation at postal booking. INR 20 light mailers, INR 40 medium boxes and INR 120 heavy cartons are packaging allowances; actual expense may differ. Speed Post and Standard/Registered Parcel can have different tariffs. The report defaults to Standard Parcel, or Registered Parcel for oversized goods; the actual booked service and its postage must be checked against the postal receipt.

Dispatch PIN is 673602. Exact matching dispatch PIN and the previously supplied destination PIN 673661 are known locally. Other zone labels use the customer's entered state or remain unconfirmed. PIN-number subtraction is never used as distance in kilometres. Zone labels must be reviewed when the address or PIN is uncertain; the reference cost range is not presented as a confirmed route quote.

## Private order evaluation

Each new tier-policy purchase stores a private MySQL report under its original order ID, with:

1. Cart Contents & Total Weight.
2. Destination Zone.
3. Actual India Post Cost, or explicitly labelled estimates until booked.
4. Customer Shipping Fee Charged.
5. Net Profit Impact (shipping contribution/subsidy and, when cost records exist, margin before payment fees).
6. Fulfillment & Packaging Instruction.

Open Orders → Delivery & margin to view the report and record the postal receipt's GST-inclusive postage and actual packaging expense. These internal updates never change the customer's original bill. Product purchase costs are optional private fields, stored separately from the public catalogue. Without them, margin coverage is marked unknown. Free shipping and oversized handling are subsidies, not a guarantee of a profitable order; payment fees, RTO, refunds and other business expenses need separate accounting.

The original order-time report is retained when catalogue prices or delivery rules change. Historical orders without a tier-policy report are not silently recalculated. Owner edits use version checks, and the one-time policy activation keeps a private snapshot of the previous shipping configuration. Later owner changes survive server restarts.
