# Razorpay Test Mode

The Python server integrates Razorpay Standard Checkout with MySQL order/payment records. **Only `rzp_test_` keys are accepted. Live keys are rejected.** No real money is collected by Test Mode.

## Private configuration

Configure these values in your server's secret settings or private root `.env`:

```dotenv
RAZORPAY_KEY_ID=your_test_key_id
RAZORPAY_KEY_SECRET=your_test_key_secret
RAZORPAY_WEBHOOK_SECRET=your_separate_random_webhook_secret
```

Never put actual values in HTML, JavaScript, GitHub, screenshots or documentation. The Key ID is returned to checkout when needed; the Key Secret and webhook secret remain on the server. MySQL stores provider order/payment IDs, amount in paise, currency, status and deduplication event IDs—not card details, CVV, PIN, OTP, or API secrets.

For Docker, these variables are forwarded privately by `compose.yaml`. Run `docker compose up --build -d`. On other hosts, install existing backend requirements and run the migrations before restarting the API:

```sh
PYTHONPATH=backend alembic -c backend/alembic.ini upgrade head
```

Firebase server credentials are still required for real customer login. Automated tests stub identity only in an isolated `_test` database; the production app never bypasses Firebase verification.

## Checkout flow

1. MySQL validates approved inventory and calculates the INR quote.
2. Choosing Razorpay creates one retry-safe shop order in **Awaiting Payment** and reserves stock.
3. The server creates a Razorpay order using that amount and the shop order ID as its receipt.
4. The browser loads `https://checkout.razorpay.com/v1/checkout.js` and opens a visibly labelled Test Mode checkout.
5. The server validates the checkout HMAC against its stored provider order ID, fetches the payment from Razorpay, validates order/amount/currency, and captures an authorized test payment if necessary.
6. Only a captured payment changes MySQL payment status to **paid** and the shop order to **Order Confirmed**.

A failed/cancelled checkout keeps the bag and the existing pending order. Retry the same checkout or use **My Orders → Pay / Check payment**. A failed attempt cannot downgrade a payment already recorded as paid. A lost Razorpay order-creation response is reconciled by exact receipt rather than creating another provider order blindly.

## Google Pay / UPI

The checkout includes a Google Pay / UPI choice. `/api/payments/config` checks Razorpay's merchant payment-method availability and caches the result for up to one minute. UPI stays disabled when Razorpay reports it unavailable or the capability check fails; cards and netbanking remain usable. Enabling UPI on the merchant account is required before this choice becomes available.

When UPI is available, selecting it puts a UPI block first in Standard Checkout while retaining all default payment methods. It uses the same server-created order, signature verification, capture and MySQL payment record as other Razorpay payments. The preference is a browser display setting; the API payment type remains `RAZORPAY`.

Test UPI success with `success@razorpay` and failure with `failure@razorpay`. Launching Google Pay through UPI Intent and scanning a UPI QR code require Live Mode, according to the [Standard Checkout testing documentation](https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps/). No direct Google Pay app launch or QR payment is simulated by the website. Live payments remain disabled in this integration.

Configuration uses Razorpay's documented [payment-method blocks and sequence](https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/configure-payment-methods/understand-configuration/). Google Pay is provided by Razorpay's [UPI integration](https://razorpay.com/docs/payments/payment-methods/upi/google-pay/); device/browser and merchant activation determine availability.

Unpaid online orders retain their inventory reservation. This first test integration deliberately does not automatically restock an unpaid order while its Razorpay order could still accept a delayed payment. Review abandoned orders with the gateway before introducing an expiration/cancellation policy. Paid online orders require a separate reviewed refund implementation before cancellation; the current admin screen refuses to cancel them automatically. Cash-on-delivery orders retain the existing cancellation/restock behavior.

## Webhook setup

For public server-to-server notifications, the backend must have a reachable HTTPS address. In **Razorpay Dashboard → Test Mode → Account & Settings → Webhooks**, add:

```text
https://YOUR-BACKEND-DOMAIN/api/payments/razorpay/webhook
```

Use the same private `RAZORPAY_WEBHOOK_SECRET` and enable `payment.captured`, `payment.authorized`, `payment.failed`, and `order.paid` events. Do not use the API Key Secret as the webhook secret. The endpoint validates the HMAC over the exact raw request bytes and deduplicates notifications. It also fetches the authoritative payment before updating MySQL.

A localhost server cannot receive Razorpay webhooks directly. A temporary HTTPS tunnel or a deployed test backend is needed for a real delivery test. Do not expose the test-only Firebase stub server publicly. If a webhook is delayed, authenticated payment-status checks can reconcile the payment through Razorpay's API.

## Routes

| Route | Use |
|---|---|
| `GET /api/payments/config` | Whether Test Mode checkout is configured; no secrets |
| `POST /api/payments/razorpay/{shop_order_id}/checkout` | Create or resume the current user's gateway checkout |
| `POST /api/payments/razorpay/{shop_order_id}/verify` | Verify signature and captured payment |
| `GET /api/payments/razorpay/{shop_order_id}/status` | Reconcile the user's payment using Razorpay |
| `POST /api/payments/razorpay/webhook` | Signed, retry-safe provider notification |

## Testing

See [PAYMENT_TEST_REPORT.md](PAYMENT_TEST_REPORT.md) for the actual captured Test Mode transaction and the limits of the checks.

Run the backend test suite against a throwaway MySQL `_test` database as described in [README.md](README.md). Gateway unit tests use an explicit fake adapter and never access a real merchant account. They cover valid capture, forged signatures, wrong amounts, customer isolation, retries after failures, uncertain gateway creation, webhook signatures/deduplication and rejection of live keys.

UI contract tests block external payment services and simulate SDK callbacks:

```sh
CHROMIUM_EXECUTABLE=/usr/bin/chromium node tests/razorpay-browser-check.cjs
```

For an actual Razorpay Test Mode transaction, use the official [test card documentation](https://razorpay.com/docs/payments/payments/test-card-details/) and [Standard Checkout integration guide](https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps/). Use test cards only; do not enter real card/bank details. A provider test transaction and a simulated gateway unit test are different checks. Public webhook registration/delivery and real SMS login must be verified separately once their hosting and account configuration exist.
