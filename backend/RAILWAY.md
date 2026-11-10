# Publish the complete BabyOne test site on Railway

The repository includes `railway.json` for the **web service**. It builds the existing Dockerfile, runs SQL migrations and the repeatable catalog import, listens on Railway's assigned `PORT`, and checks `/api/ready` before routing visitors to the app. No credentials are included in this file.

## Account connection

Connect Railway and authorize access to `firstbrickthings/firstbrick`. Check the account's available credits and plan before provisioning resources; this repository does not approve or select paid hosting.

## Services

Create a project with:

1. A MySQL service using persistent storage.
2. A web service connected to this GitHub repository, with the repository root as its build context. The included Railway configuration selects `backend/Dockerfile`.

The Python web service serves the existing frontend, assets and `/api` together, so a separate frontend host is unnecessary.

## Private variables for the web service

- `DATABASE_URL`: reference the MySQL service's private `MYSQL_URL`. The app accepts `mysql://` and explicitly selects its installed PyMySQL driver. Use Railway reference variables rather than copying database passwords into code.
- `FIREBASE_PROJECT_ID`: `baby-one-a5cd4`.
- `FIREBASE_SERVICE_ACCOUNT_JSON`: the Firebase Admin service-account JSON, entered only through private hosting settings. This avoids needing a local credentials-file mount on the hosted server. Do not paste it into chat or GitHub. Application Default Credentials / `GOOGLE_APPLICATION_CREDENTIALS` remain supported when the JSON variable is empty.
- `ADMIN_FIREBASE_UIDS`: your verified Firebase user UID(s), comma-separated.
- `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`: private **test** configuration from the Razorpay integration guide. Do not commit actual values.
- `ALLOWED_ORIGINS`: the site's generated HTTPS origin; include a custom domain only if you use one.

Do not use `backend/tests/browser_server.py` or any test-token verifier in a public deployment. The production entry point is `app.main:app`, launched by `app.serve`.

## After deployment

Generate the service's public HTTPS domain. Update the canonical/Open Graph URL and image URL in `index.html` to that public domain. Keep `assets/site-config.js` at `/api` when frontend and backend share the same service.

Add the hostname (without `https://` or a port) to Firebase Authentication's authorized domains. Register `https://YOUR-DOMAIN/api/payments/razorpay/webhook` in the Razorpay **Test Mode** dashboard, with the matching private webhook secret and the events listed in `RAZORPAY.md`.

Verify:

- `/api/ready` returns `{"database":"ready"}`.
- Home page, mobile navigation, product search and product details render.
- Real SMS sign-in succeeds and the API recognizes the signed-in customer.
- The administrator can open **Manage store**, confirm real test-product details and stock, and enable that item for sale.
- A Razorpay test payment is captured, MySQL records it as paid, order history works, and an actual provider webhook delivery succeeds.

All imported sample products start with selling disabled and zero stock. Do not turn the whole catalog into sellable inventory just to make the preview appear active. Live Razorpay keys remain rejected by this test integration.

See the official [Railway config reference](https://docs.railway.com/config-as-code/reference) and [pre-deploy documentation](https://docs.railway.com/deployments/pre-deploy-command).
