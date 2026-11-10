# BabyOne / firstbrick

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
- Customer order history and saved delivery addresses across devices.
- A **Manage store** screen for approved administrators: add/edit products, verify selling prices, set stock, enable sales, change delivery fees, and process orders.
- Order status history, valid fulfilment transitions, and restocking on cancellation.
- SQL migrations, a repeatable catalog import, Docker configuration, and automated tests.

The imported **1,569 catalog records** remain drafts for selling: prices need confirmation, stock starts at zero, and sales are disabled until approved. Existing source records and photos are retained. Cash on delivery and Razorpay **Test Mode** checkout are supported. Live payments remain disabled. See the [payment integration guide](backend/RAZORPAY.md).

## Next steps

1. Configure Firebase credentials and your administrator UID.
2. Confirm real prices and quantities in **Manage store**.
3. Choose a Python/MySQL hosting provider, configure HTTPS and backups, and set the frontend's API URL if using a separate host.

See [setup, hosting and testing instructions](backend/README.md).
