# Current online test deployment

Website: https://babyone-web-test.up.railway.app

Railway project: https://railway.com/project/ac5d080a-f86f-42b9-ad63-adeb1824df69

Environment: `test`; services: `babyone-web` and `MySQL`. MySQL uses a private network connection and a persistent 500 MB volume. The frontend and Python API share the same HTTPS domain.

Verified on the hosted site:

- MySQL readiness endpoint responds successfully.
- Public catalog returns 768 active products (the import also preserves hidden source records).
- Desktop and mobile browser checks passed with no uncaught JavaScript errors.
- Razorpay Test Mode configuration is enabled; actual test credentials are private Railway variables.
- A signed receiver-check notification is accepted by the public webhook endpoint. This is not proof of an actual Razorpay dashboard delivery.

## Required Firebase owner actions

Open https://console.firebase.google.com/project/baby-one-a5cd4/authentication/settings and add `babyone-web-test.up.railway.app` to Authorized domains. The publicly readable configuration currently lists only the project's original Firebase domains.

Enable Phone sign-in and the India SMS region if not already enabled. Generate the Firebase Admin service-account key in Project settings → Service accounts, then add its JSON privately to the web service's `FIREBASE_SERVICE_ACCOUNT_JSON` Railway variable. Never commit or paste that key into chat. Add the intended administrator's Firebase UID to `ADMIN_FIREBASE_UIDS`.

These actions require access to the Firebase project. The public Firebase API key embedded in the original HTML cannot grant administrative access. No mock authentication has been deployed publicly.

## Required Razorpay dashboard action

In Test Mode, register `https://babyone-web-test.up.railway.app/api/payments/razorpay/webhook`, using the private `RAZORPAY_WEBHOOK_SECRET` already stored on the web service. Subscribe to the events listed in RAZORPAY.md. API verification works independently of notifications, but real hosted checkout still requires working customer sign-in and approved product inventory.

The earlier actual captured/failed gateway tests used the isolated test environment described in PAYMENT_TEST_REPORT.md. Hosted end-to-end SMS/payment testing remains pending the account configuration above.
