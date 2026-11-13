# BabyOne / firstbrick

**Online test site:** https://babyone-web-test.up.railway.app

Frontend, Python API and MySQL are deployed. Razorpay Test Mode is configured. Firebase phone login is configured on the deployed site. Provider limits and delivery rules still apply. Live-payment support uses separate private credentials and an explicit mode switch; live readiness is checked before new charges are allowed.

BabyOne now includes a **Python FastAPI backend and MySQL 8.4 database**, connected to the existing storefront. Firebase handles SMS sign-in; MySQL owns products, approved prices, inventory, customer delivery profiles and orders.

The backend code is ready to configure and run. Pushing this repository does **not** deploy a public database or API. GitHub Pages can host the frontend, but cannot run Python or MySQL.

## Start with Docker

Install Docker Desktop (or Docker Engine with Compose), then run from this repository:

```sh
python backend/setup.py
docker compose up --build -d
```

Open http://localhost:8000. The API documentation is at http://localhost:8000/api/docs. Database tables and the catalog are initialized automatically. MySQL data persists in a Docker volume, and its port is not exposed publicly.

This starts the storefront and database. **Real sign-in and checkout also need Firebase server credentials**; complete the steps in [backend/README.md](backend/README.md).

## What is included

- Public product/category API, pagination and search.
- Firebase ID-token verification on the Python server; administrator UIDs configured privately on the server.
- Server-calculated INR prices and delivery fees; browser-supplied prices are rejected.
- Transactional stock reservations, protection against overselling, and retry-safe order creation.
- Customer order history, saved delivery addresses and versioned account carts across devices.
- Customer profile and saved-cart inspection for verified store administrators.
- WhatsApp chat button, separate opt-in choices and a durable queue for 20-minute cart reminders and saved order-status updates. Cloud API account registration, private credentials and template approval are required before automatic sending; see the [setup guide](assets/whatsapp-setup.html).
- A **Manage store** screen for approved administrators: add/edit products, verify selling prices, set stock, enable sales, change delivery fees, and process orders.
- Order status history, valid fulfilment transitions, and restocking on cancellation.
- SQL migrations, a repeatable catalog import, Docker configuration, and automated tests.

The imported **1,569 catalog records** remain drafts for selling: prices need confirmation, stock starts at zero, and sales are disabled until approved. Existing source records and photos are retained. Cash on delivery and Razorpay **Test Mode** checkout are supported. The dedicated no-charge test item is unavailable in live mode; regular products require approved stock, prices and delivery rules. See the [payment integration guide](backend/RAZORPAY.md).

## Next steps

1. Configure Firebase credentials and your administrator UID.
2. Confirm real prices and quantities in **Manage store**.
3. Confirm India Post rate cards and product/carton measurements in Dashboard → Delivery charges. PIN prefixes select approved postal zones; the site does not calculate road distance or fetch live postal tariffs.
4. Connect and verify the store’s Meta WhatsApp account, approve templates and test with an opted-in recipient before enabling automatic sends.
5. Monitor the existing Railway deployment and keep database backups private.

See [setup, hosting and testing instructions](backend/README.md).

For an online link to the complete site, see the [Railway deployment setup](backend/RAILWAY.md).
