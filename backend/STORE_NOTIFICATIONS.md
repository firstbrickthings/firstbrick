# Checkout and store notifications

The Python/MySQL backend owns prices, orders, saved WhatsApp preferences, notification queues and the owner's unread-order cursor. UI choices never confirm a payment. Razorpay capture verification and signed webhooks remain authoritative.

## The ₹1 catalogue check

`babyone-hospital-bag-payment-check` appears under **New Born → Hospital Bags**. Its initial price is ₹1, stock is 5, and delivery is zero for this listing alone. It is explicitly a live payment check with no physical product supplied. It requires Live Mode, quantity 1, and a separate order from regular goods. Buy Now leaves the regular bag intact, including its saved MySQL cart. Regular goods retain their delivery rules.

The seed creates this listing once and saves `setup:one-rupee-check-v1`; later owner edits, hiding the listing and stock changes survive redeployments. It does not overwrite any existing product's price or stock. Payment checks use `gateway_check` and do not count as new sales, request fulfillment, send order WhatsApp messages or queue owner order emails. The separate existing ₹10 owner diagnostic remains independent.

## Owner order emails

One `owner_order_email` event is queued in `reporting_events` after a normal prepaid order is captured, or a COD order is confirmed. A deterministic event ID prevents duplicate notifications from payment retries or repeated webhooks. Sheets reporting explicitly excludes this channel.

The existing Gmail OAuth connection sends the HTML order summary to the configured store mailbox (`AUTH_EMAIL_SENDER`, currently `babyonestores@gmail.com`). The email includes product names, quantities, prices, delivery cost, payment state, customer contact and delivery address. This is an order summary, not a GST tax invoice. `ORDER_EMAIL_ENABLED` defaults to true; the worker cannot send without the Gmail connection.

Configure `GMAIL_OAUTH_CLIENT_ID` and `GMAIL_OAUTH_CLIENT_SECRET` privately in Railway, then authorize the store mailbox from **Dashboard → Login & email**. Existing OAuth redirect: `/api/auth/gmail/callback`. **Dashboard → Notifications** shows queue states and a read-only mailbox authorization check. A successful Gmail API acknowledgement means accepted by Gmail, not proven delivery to the inbox.

The worker commits a send intent before calling Gmail. Uncertain responses and interrupted sends pause for review instead of automatically resending. Explicit pre-send transient failures and rate limits may retry with backoff. Queued order emails older than seven days expire. No historical orders are automatically backfilled.

## WhatsApp preferences and delivery

The optional order-update permission and separate cart-reminder permission are saved to the verified customer's MySQL record. A saved yes or no removes the permission section from future checkouts, across devices. Preferences remain editable under Account; STOP also opts out through the signed WhatsApp webhook. Cookies and store terms do not substitute for these choices.

Cloud API access, the verified store sender, approved utility/marketing templates and signed webhook setup are still required. The floating chat button works independently. The Notifications panel reports missing configuration and distinguishes queued, accepted, delivered and uncertain messages. Existing 20-minute cart-reminder cancellation, order-update and opt-out protections remain in place.

## Dashboard and reviews

The owner-only Dashboard and Orders badges count unseen `Order Confirmed` events for real purchases, including online orders only after payment verification. Viewing Orders acknowledges the loaded cursor in MySQL; opening the overview does not clear the badge. A later arriving order stays unread. Counts refresh every 30 seconds and on focus.

Customer review submissions now save to MySQL, require a paid or delivered purchase, and remain unpublished until the owner approves them under Website Reviews. Published verified submissions receive a Verified purchase label. Owner-entered feedback receives no automatic verification claim. Sample review cards appear only in the dashboard's clearly labelled design preview; no invented reviews are published.

For listing-page artwork, upload a banner under the existing banner editor and choose **Product listing pages** as its position. Until then, the listing uses existing store/category artwork without overlay text or buttons.
