# Razorpay Test Mode

The Python server integrates Razorpay Standard Checkout with MySQL order/payment records. **Test and Live modes use separate private keys.** `RAZORPAY_MODE` defaults to `test`. Live charges require verified live credentials and a configured live webhook. Test Mode does not collect real money.

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

The checkout shows UPI, Card / Netbanking, and (for regular products) Cash on delivery as separate choices. Selecting UPI expands four app tiles: Google Pay, PhonePe, Paytm and BHIM. The order amount is filled automatically from the server quote. A UPI Lite explanation identifies it as a feature within a supported app, rather than a separate payment app. The website never asks for a UPI PIN.

`/api/payments/config` checks Razorpay's merchant payment-method availability and caches the result for up to one minute. Customers can preview app choices when UPI is unavailable, but the payment button is disabled and a direct Card / Netbanking fallback is offered. No order is created for an unavailable method. Enabling UPI on the merchant account is required before processing a UPI test payment.

When UPI is available, selecting it puts a UPI block first in Standard Checkout, with the selected app's documented `apps` preference, while retaining default payment methods. App launch depends on Razorpay, device/browser support and Live Mode; the Test Mode interface explicitly labels app selection as a preview. It uses the same server-created order, signature verification, capture and MySQL payment record as other Razorpay payments. App selection is a browser display preference; the API payment type remains `RAZORPAY`.

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

Run the backend test suite against a throwaway MySQL `_test` database as described in [README.md](README.md). Gateway unit tests use an explicit fake adapter and never access a real merchant account. They cover valid capture, forged signatures, wrong amounts, customer isolation, retries after failures, uncertain gateway creation, webhook signatures/deduplication and rejection of wrong-mode keys. Live-mode unit/browser checks use synthetic credentials and mocked provider responses.

UI contract tests block external payment services and simulate SDK callbacks:

```sh
CHROMIUM_EXECUTABLE=/usr/bin/chromium node tests/razorpay-browser-check.cjs
```

For an actual Razorpay Test Mode transaction, use the official [test card documentation](https://razorpay.com/docs/payments/payments/test-card-details/) and [Standard Checkout integration guide](https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps/). Use test cards only; do not enter real card/bank details. A provider test transaction and a simulated gateway unit test are different checks. Public webhook registration/delivery and real SMS login must be verified separately once their hosting and account configuration exist.

## Live payments

Set `RAZORPAY_LIVE_KEY_ID` and `RAZORPAY_LIVE_KEY_SECRET` privately in Railway. Keep `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` for historical test-order reconciliation. Use a separate strong `RAZORPAY_LIVE_WEBHOOK_SECRET`.

With `RAZORPAY_PREPARE_LIVE=true`, startup authenticates the live pair through a read-only order-list request, then uses the provider webhook API to register/update only this store's dedicated callback. It does not create a payment order, charge a card or debit a bank account. Other webhook URLs remain untouched. New live orders remain disabled until the credentials and webhook are ready.

If the account cannot manage webhooks through its API, configure this in Razorpay Dashboard → Live Mode → Account & Settings → Webhooks:

- URL: `https://babyone-web-test.up.railway.app/api/payments/razorpay/webhook/live`
- Secret: the value of `RAZORPAY_LIVE_WEBHOOK_SECRET`, copied privately from Railway. Do not use an API Key Secret.
- Events: `payment.authorized`, `payment.captured`, `payment.failed`, `order.paid`.
- Keep the webhook enabled. After confirming the correct URL/events/secret, set `RAZORPAY_LIVE_WEBHOOK_CONFIRMED=true` and redeploy. This is owner confirmation of setup, not evidence of a delivered event.

Set `RAZORPAY_MODE=live` after preparation succeeds. The public payment configuration reports the active mode, readiness and provider UPI availability. The frontend shows real-payment labels and keeps the existing UPI app preferences. Payment approval happens inside the supported UPI app; the store never collects a UPI PIN.

Each payment stores its original mode and Key ID. Existing rows migrate to `test`; paid history retains that label. An unpaid test order cannot be reopened as a live charge. Quote hashes change when the configured mode changes, requiring customers to review checkout again. The ₹10 no-charge test product is disabled in live mode. Product prices, stock and measured delivery rules still need owner approval before regular sales.

Verification checks HMAC signatures, provider order/amount/currency and captured state in both modes. Test and live callbacks use separate endpoints and secrets, and cannot confirm one another's records. A browser success callback alone never marks an order paid. Complete one owner-initiated live payment to verify the end-to-end UPI flow and inspect its captured status; bank settlement follows the provider's schedule.
