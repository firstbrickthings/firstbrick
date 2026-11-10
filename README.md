# BabyOne / firstbrick

BabyOne's static storefront: responsive shopping, categories, product details, wishlist, Firebase phone verification and order requests.

## Run locally

Serve the entire repository, including `assets/`:

```sh
python -m http.server 8081
```

Open http://localhost:8081. No build step is required. Open through a web server rather than double-clicking `index.html`, because Firebase modules and browser storage need a web origin.

## Frontend improvements

- Visible homepage heading and shopping action, with a background fallback and a slideshow pause control.
- Locally bundled logo, available source images, fonts, icons and compiled Tailwind CSS. Raster images use WebP. Large catalog scripts load as separate cacheable files.
- Product grids show 24 records at a time; filters and sorting reset the visible batch.
- Escaped search queries and keyboard-accessible result buttons.
- Explicit form labels, a skip link, dialog keyboard containment, focus restoration and reduced-motion support.
- Sign-in opens on request. Delivery details are collected during checkout.
- Checkout keeps the bag until the existing cloud store acknowledges receipt, reuses an order ID on retry, and labels the request as awaiting store confirmation. Card payment is not offered.

## Hosting and backend requirements

Deploy `index.html` **and all of `assets/` together**. Canonical and social preview URLs currently target `https://firstbrickthings.github.io/firstbrick/`; update them if the actual deployed domain differs. This commit does not enable GitHub Pages or change Firebase configuration.

Firebase phone sign-in still requires an authorized HTTPS domain, Phone Authentication, the India SMS region, reCAPTCHA and sufficient quota. No test sends real SMS.

The existing Firebase project and Firestore collection are preserved. Its deployed security rules and customer write permissions have not been verified here. An unavailable or denied cloud write leaves checkout unconfirmed and the bag intact. Legacy queued orders from earlier versions retain their existing synchronization behavior.

**Before accepting live sales:** validate prices, shipping and stock on a trusted backend, link customer authentication to order ownership, verify database rules and order delivery to the owner, and integrate a payment provider if online payments are needed. Browser-calculated totals are estimates; cloud receipt does not establish stock availability or payment success. Sample catalog prices and product details still need owner confirmation.

## Browser regression checks

Install Playwright as a development dependency, install its Chromium browser, and keep the local server above running:

```sh
npm install --no-save playwright
npx playwright install chromium
node tests/browser-check.cjs
```

Optional: set `BASE_URL` to the local server and `CHROMIUM_EXECUTABLE` to an existing Chromium executable. Tests block all other origins and stub authentication and order submission; they never write live orders, send SMS or transmit analytics. They cover responsive layout, search injection, pagination, form labels, keyboard dialogs, order failure/success and retry IDs.
