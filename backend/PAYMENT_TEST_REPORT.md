# Payment verification results

## Actual Razorpay Test Mode

- Supplied test credentials authenticated successfully against Razorpay's API.
- The BabyOne site opened the real Razorpay-hosted Standard Checkout using a local Python/MySQL test server.
- A ₹559.00 INR test payment was completed using Razorpay's official test card and mock bank's Success action.
- An independent Razorpay API fetch confirmed `status=captured`, `captured=true`, `amount=55900`, `currency=INR`.
- MySQL recorded the provider order ID and payment ID, payment status `paid`, and shop order status `Order Confirmed`.
- A second actual Razorpay mock-bank transaction was intentionally failed. Reconciliation recorded `payment_status=failed`, kept the order in `Awaiting Payment`, and retained the cart item.
- No real money moved. Test card data and API secrets are not saved in MySQL or this repository.

## Automated and local notification checks

- 17 Python/MySQL tests passed, covering existing commerce behavior and payment signatures, amount validation, authorization, capture, failed-attempt retries, uncertain creation reconciliation, webhook deduplication and rejection of live keys.
- Razorpay UI contract tests passed for success, verification rejection and cancellation; unpaid bags remained intact.
- The existing 18-check frontend smoke suite passed.
- A locally generated signed webhook carrying the actual captured provider payment was accepted. Replaying the same notification was recognized as a duplicate. Its handler independently fetched the real Razorpay payment before committing.

## Not established by these tests

The local identity fixture replaced Firebase SMS login for browser tests. Real SMS sign-in requires the Firebase server credentials and domain configuration described in the backend guide.

The notification check was locally signed test delivery, not a Razorpay-to-public-server webhook. Public HTTPS deployment, dashboard webhook registration and an actual provider-originated webhook delivery remain hosting/account setup steps. No live payment keys, KYC activation, bank settlement or real-money payment were enabled or tested.
