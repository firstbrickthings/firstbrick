# Current online test deployment

Website: https://babyone-web-test.up.railway.app

Railway project: https://railway.com/project/ac5d080a-f86f-42b9-ad63-adeb1824df69

Environment: `test`; services: `babyone-web` and `MySQL`. MySQL uses a private network connection and a persistent 500 MB volume. The frontend and Python API share the same HTTPS domain.

Verified on the hosted site:

- MySQL readiness endpoint responds successfully.
- Public catalog contains 768 imported active products plus the separate payment-test item (the import also preserves hidden source records).
- Desktop and mobile browser checks passed with no uncaught JavaScript errors.
- Razorpay Test Mode configuration is enabled; actual test credentials are private Railway variables.
- A signed receiver-check notification is accepted by the public webhook endpoint. This is not proof of an actual Razorpay dashboard delivery.

## Firebase login

The Railway domain is authorized and the Firebase Admin JSON is configured privately on the web service. The owner has confirmed that OTP login works on the deployed website.

Add the intended administrator's Firebase UID to `ADMIN_FIREBASE_UIDS` to manage regular catalogue prices, stock and sales approval. Never commit or paste the Firebase service-account key into chat.

No mock authentication is deployed publicly.

## Dedicated payment-test product

`ENABLE_TEST_CHECKOUT=true`, together with valid Razorpay Test Mode credentials, enables one separate **Razorpay Test Product**, priced at ₹10 with zero delivery. The seed creates it once and preserves consumed stock on later restarts. Imported product sales and stock are not changed. Turning the flag off or using a non-test key prevents purchases of the test item.

Open `https://babyone-web-test.up.railway.app/?payment-test=1` or choose **Try test payment** above the homepage. Confirm **Use test product only** (this replaces the current bag), complete the delivery form, then use Razorpay Test Mode. This product cannot be mixed with regular products or bought with cash on delivery. No physical item is delivered and no real money moves.

## Required Razorpay dashboard action

Razorpay currently reports `upi: false` for this test merchant. The checkout shows Google Pay / UPI as unavailable and offers cards/netbanking. The owner must request or enable UPI in the Razorpay account; the website refreshes that capability within one minute. Google Pay app launch and UPI QR require Live Mode, and this deployment continues to reject live keys.

In Test Mode, register `https://babyone-web-test.up.railway.app/api/payments/razorpay/webhook`, using the private `RAZORPAY_WEBHOOK_SECRET` already stored on the web service. Subscribe to the events listed in RAZORPAY.md. API verification works independently of notifications, but real hosted checkout still requires working customer sign-in and approved product inventory.

The earlier actual captured/failed gateway tests used the isolated test environment described in PAYMENT_TEST_REPORT.md. A captured payment on the deployed website must still be verified after the owner completes its test checkout.
