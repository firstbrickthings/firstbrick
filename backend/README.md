# Python + MySQL setup

The storefront uses `/api` on the same origin by default. The Python app serves the HTML and assets as well as the API, so one host can serve the complete site. Firebase continues to send and verify SMS; the Python server verifies the resulting Firebase ID token independently.

## 1. Start the local server

From the repository root:

```sh
python backend/setup.py
docker compose up --build -d
```

`setup.py` creates `.env` with random MySQL passwords and a private `secrets/` folder. It does not overwrite an existing `.env`. Both are ignored by Git and excluded from Docker image builds. Never commit credentials.

Open http://localhost:8000. Check http://localhost:8000/api/ready for database readiness. On first start, Alembic creates the tables and the import command inserts the original catalog. Later starts skip existing product IDs and preserve your approved prices and stock.

## 2. Connect Firebase securely

Use your existing Firebase project, `baby-one-a5cd4`:

1. In Firebase Console → Project settings → Service accounts, create a server service-account key. Save it as `secrets/service-account.json`. Keep it private; do not paste it into chat or put it in `assets/`.
2. Make the file readable by the container's UID 10001 through your host's file permissions. Do not make it publicly readable. On Linux, one option is to grant that UID read access with an ACL; on managed hosting use its secret-file feature instead.
3. Ensure Phone Authentication is enabled, India SMS is permitted, and the site domain is listed in Authentication → Settings → Authorized domains. For local development, add `localhost` (without scheme or port).
4. Restart the API: `docker compose restart api`.
5. Sign in on the website using your phone and a real SMS code.
6. Find that account in Firebase Console → Authentication → Users. Copy its **UID** into `ADMIN_FIREBASE_UIDS` in the private root `.env`. Multiple UIDs may be comma-separated.
7. Run `docker compose up -d --force-recreate api` so the new environment is applied. Refresh the website after signing in; **Manage store** appears for an authorized administrator.

The server verifies signature, project/audience, expiry and revocation. It derives phone and UID from the verified token. Changing a browser profile, phone field or session-storage flag cannot grant admin access. The Firebase service account is not shipped to browsers. On hosts with Google workload identity, Application Default Credentials can replace a downloaded key.

## 3. Approve your catalog

Open **Manage store → Products & stock**. Search for a product, then:

- Verify its name, description, image and category.
- Enter the actual INR price and units in stock for each size/option.
- Enable the options you sell and check the product's selling-price/inventory confirmation.
- Save to MySQL.

Import intentionally sets every product to `sale_enabled=false` and stock zero. Many original entries were samples or estimates. Do not approve an item until you have verified it. Prices formerly displayed in another currency were converted using the frontend's existing 83.5 conversion solely as an import estimate; they still require approval.

**Delivery fees** edits the fixed charge for each category. A category is charged once per order regardless of quantity. The order server calculates the charge from MySQL, and refuses an old quote if its prices or fees changed.

**Orders** lists customer orders, delivery details and items. Valid transitions are Confirmed → Packed → Shipped → Out for Delivery → Delivered. Orders can be cancelled before shipment; the server restores inventory exactly once. Product edits detect stale versions so an old admin form cannot overwrite stock changed by an order.

The import preserves explicit product patterns from the source. The old automatically illustrated pattern samples are not offered as sellable inventory. Product patterns can be configured through the authenticated product API if needed.

## 4. Run without Docker

Use Python 3.12 and a separate MySQL 8.4 database/user. From the repository root:

```sh
python -m venv .venv
. .venv/bin/activate
pip install -r backend/requirements.txt
```

Set the variables in `backend/.env.example` through your shell or your host's secret settings. `DATABASE_URL` must use the `mysql+pymysql` driver; URL-encode special characters in credentials. Use the managed provider's TLS connection options for a remote database. The local Docker database uses a private Docker network.

Then run:

```sh
PYTHONPATH=backend alembic -c backend/alembic.ini upgrade head
PYTHONPATH=backend python -m app.seed
PYTHONPATH=backend uvicorn app.main:app --host 127.0.0.1 --port 8000 --no-access-log
```

On Windows, set `PYTHONPATH=backend` in PowerShell (`$env:PYTHONPATH='backend'`) before running the commands. Do not use a public MySQL root account for the app. The migration user needs schema permissions; for production, migrations can run separately with a privileged migration identity and the application can use a CRUD-only identity.

## 5. Hosting

A managed Python service plus managed MySQL is a straightforward choice; a VPS with Docker Compose also works. The supplied Compose setup binds the API to **localhost only** and keeps MySQL private. Put an HTTPS reverse proxy in front of the API for public hosting. Set request size limits (256 KB for API JSON), rate limits and automatic certificate renewal at the proxy/host. Set allowed frontend origins through `ALLOWED_ORIGINS`.

If the frontend remains on GitHub Pages, edit `assets/site-config.js`:

```js
window.BABYONE_API_BASE = 'https://YOUR-BACKEND-DOMAIN/api';
window.BO_USE_MYSQL = true;
```

Also add `https://firstbrickthings.github.io` to `ALLOWED_ORIGINS` on the backend. Use your actual domain in the site's canonical/social metadata and in Firebase's authorized-domain settings. GitHub Pages cannot run the Python API or MySQL.

Configure persistent MySQL storage, automatic backups and a tested restore procedure. For a local backup, write outside the repository or to a private backup location:

```sh
docker compose exec -T db sh -c 'MYSQL_PWD="$MYSQL_PASSWORD" mysqldump -u babyone --single-transaction --no-tablespaces babyone' > /YOUR/PRIVATE/BACKUP/PATH/babyone.sql
```

Database volume deletion (`docker compose down -v`) deletes store data; normal `docker compose down` retains it. Do not migrate old spreadsheet/browser/Firebase orders automatically: those historical records need an explicit, reviewed import. Optional existing Firebase media/banner uploads remain separate from MySQL commerce. New customer profiles, catalog prices and orders are not dual-written to the old spreadsheet/Firestore order path.

## API overview

Interactive documentation: `/api/docs`. Protected routes require `Authorization: Bearer <Firebase ID token>`.

| Route | Purpose |
|---|---|
| `GET /api/catalog/products` | Public paginated catalog/search |
| `GET /api/catalog/categories` | Categories and delivery charges |
| `GET /api/me` | Verified identity and admin role |
| `GET/PUT /api/me/profile` | Customer's delivery details |
| `POST /api/checkout/quote` | Server prices, fees and stock validation |
| `POST /api/orders` | Atomic order creation and stock reservation |
| `GET /api/me/orders` | Customer's own order history |
| `GET /api/me/orders/{id}` | Customer's own tracking record |
| `GET/POST /api/admin/products` | Owner catalog listing/creation |
| `PUT /api/admin/products/{id}` | Versioned inventory/product updates |
| `GET /api/admin/orders` | Owner order queue |
| `PATCH /api/admin/orders/{id}` | Fulfilment/cancellation |
| `PUT /api/admin/categories/{id}` | Delivery fees/categories |

Money is serialized as decimal strings. Quotes do not reserve stock; order creation rechecks it under database row locks. Each customer/order request key is unique, so a network retry returns the original order without reserving stock twice. Cash on delivery and Razorpay Test Mode are implemented. See [RAZORPAY.md](RAZORPAY.md) for private key configuration, verification, payment states and webhook setup. Live payments remain disabled.

## Tests

Backend tests require a **throwaway MySQL database ending in `_test`**. They refuse other database names, and recreate the schema for each test. Set `DATABASE_URL` to that test database, then:

```sh
pip install -r backend/requirements-dev.txt
PYTHONPATH=backend pytest backend/tests -q
```

Tests stub only Firebase token verification; SQL transactions and row locking use real MySQL. They cover authentication/authorization, customer isolation (including case-sensitive UIDs), server totals, forged prices, stale quotes, stock limits, cancellation, concurrent buyers, concurrent retries and admin edit conflicts.

Frontend smoke tests use local API fixtures and block external origins:

```sh
npm install --no-save playwright
npx playwright install chromium
python -m http.server 8081
# In another terminal:
node tests/browser-check.cjs
```

The full browser/MySQL test uses `backend/tests/browser_server.py`, which also refuses a database not ending in `_test`. After the backend tests leave the test bottle fixture in that database, run the seed command, then start:

```sh
PYTHONPATH=backend python -m app.seed
PYTHONPATH=backend uvicorn browser_server:app --app-dir backend/tests --host 127.0.0.1 --port 8001 --no-access-log
# In another terminal:
MYSQL_BROWSER_TEST=1 node tests/mysql-browser-check.cjs
```

The test-only token verifier must never be used for a public server. The normal production entry point is always `app.main:app`. The browser test updates the fixture bottle's price/stock and places an order in the throwaway database. It simulates a lost HTTP response and checks that the retry creates one order, charges the SQL price and deducts inventory once. Reset the test database before repeating this test.

Optional browser settings: `BASE_URL` and `CHROMIUM_EXECUTABLE`. No tests send SMS, real payments, or live customer orders.
