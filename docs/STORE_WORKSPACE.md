# BabyOne shared store update

The existing owner workspace and navigation remain. Store overview now displays verified customer records, first registrations, opted-in anonymous visit sessions, active sessions within five minutes, date filters (India time), traffic/customer charts, sources and recent customers. Historical customer signup dates stay unknown. An anonymous browser session is not a unique person.

## Publishing and preserved data

Products/inventory, categories, banners, videos and reviews save through owner-authorised API endpoints to MySQL. Content changes use version checks. Public views reload shared content approximately every 45 seconds while visible; catalogue revisions trigger a catalogue refresh. Orders refresh approximately every 30 seconds while their screen is visible. A full page reload immediately fetches current data.

Media uploads go to the private Railway S3-compatible `babyone-media` bucket; published URLs are served through `/api/media/{id}` with short-lived storage URLs. SVG/HTML uploads are refused. Images may be up to 12 MB and supported videos up to 100 MB. Authentication remains Firebase SMS plus server-side token verification and the existing owner allowlist. No provider keys are shipped to browser code.

The additive migration stores a gzip JSON snapshot of pre-update tables inside the private database before applying changes. This is a rollback copy in the same database, not an independent disaster-recovery backup. The authenticated Data backup panel downloads a complete gzip JSON export. Existing browser keys and video files are retained. Download device data for review; import individual historical orders explicitly, or prepare saved videos and then publish. Historical orders remain labelled payment-unverified and never reserve/restock inventory or initiate a payment. Their customer visibility requires the matching verified phone number. Imports cannot replace existing server orders.

## Delivery configuration

Origin defaults to 673602. The server matches the most specific owner-approved destination PIN prefix. Postal zones represent distance bands; kilometres are never inferred from PIN arithmetic. Optional known route kilometres are descriptive and must match the chosen rate band. There is no routing/geocoding API or automatic India Post quote connection.

Enter actual postal charges, applicable additional tax, packing and any COD handling/return reserve, then confirm the rate card. Draft reference postage is disabled until confirmed. Enter packed weight and dimensions for each product, using the largest enabled option. Chargeable weight is the greater of actual packed weight and length × width × height / the configured divisor. Weight bands and extra whole kilograms determine postage per parcel. Missing or unsupported destinations/measurements request a store quote; existing order totals stay unchanged.

Optional approved compact cartons combine specifically listed products within owner-tested limits. A carton uses the sum of individual packed weights plus the outer carton/filler weight, measured outer dimensions, a maximum unit count and maximum packed weight. Products also must fit the box dimensions/volume; the owner must explicitly confirm the packing combinations, since volume alone cannot prove items fit. Bulky products remain individual parcels. No guessed combined carton dimensions or automatic free/₹99 promotion is applied.

Before going live, check the rate agreement, actual measured packages and margins. Packaging consolidation can lower postage, but cannot by itself guarantee an overall product margin or eliminate return losses.

## Google Sheets reporting

MySQL remains primary. Order creation/status changes and verified payments enqueue reporting events in the same database transaction. A background worker retries failed events independently. It marks sent only after a matching event ID is acknowledged. Receiver-side locking and deduplication prevent repeated spreadsheet rows. Old opaque no-cors browser reporting is disabled.

The supplied `/exec` URL responds `BabyOne database receiver is running.` That proves reachability, not authenticated persistence. Therefore `SHEETS_ENABLED` stays false until the receiver contract is installed and verified.

1. In the existing Apps Script project, install `assets/BabyOne_Reporting_Receiver.gs` and deploy a new web-app version (execute as owner).
2. In Apps Script project settings, set private properties `BABYONE_SPREADSHEET_ID` and `BABYONE_REPORTING_SECRET`.
3. Privately set Railway `SHEETS_SECRET` to the same random secret and `SHEETS_URL` to the deployed `/exec` URL. Enable `SHEETS_ENABLED=true` only after setup. Do not paste secrets into chat or HTML.
4. Verify that a new test order produces one matching acknowledged event and one row. Retries must not add duplicates.

The receiver writes to a separate `BabyOne Orders` tab; it does not delete earlier sheets. It signs requests with HMAC, expires them after five minutes and escapes spreadsheet formula prefixes. Downloadable backup files and Sheets contain customer information and need private storage.

## Payments and login

The existing premium payment UI is retained, with UPI app choices and no QR. Provider availability is authoritative: the connected Razorpay test account currently disables UPI. Card/netbanking tests remain available. Real UPI app switching/PIN approval requires live availability and onboarding; website code cannot enable it. OTP delivery remains subject to Firebase settings, quotas and throttling; this update does not bypass authentication or promise a quota reset.

## Verification

- Backend MySQL integration tests cover ownership, inventory, idempotency, capture/webhook verification, publishing, real reviews, shipping, carton consolidation, analytics, reporting acknowledgements, backup and reviewed historic imports.
- Migration check preserves a full existing catalogue and historical customers, verifies the private snapshot and checks safe reruns/schema consistency.
- Browser checks cover the original workspace, responsive layouts, image-only promotions, premium payment states, and real API/MySQL product/review/video publishing into a second clean browser, plus owner status saves and customer tracking.
- Browser authentication/provider fixtures operate only against an isolated `*_test` database or intercept browser responses. They never weaken deployed authentication, send OTP SMS or create live charges.

## Video uploads, sharing and tracking

The Videos panel lists published and hidden videos with Edit, Publish/Hide, ordering and removal controls. Add new video opens file inputs for video and cover, title and a searchable product picker; there are no URL/product-ID inputs. Product search supports all matching results through pagination and keyboard selection. Editing keeps existing files unless replacements are selected. Old device videos can be recovered for review without removing the original files. Saving uses the shared document version, so an upload failure or a conflicting edit cannot silently overwrite a saved video.

Each product card and product detail has Share. Supported devices use native sharing; the fallback copies a product-specific `?product=ID` URL or shows a manual copy dialog. Opening that URL waits for the shared catalogue and opens the matching visible product. Unavailable products do not expose hidden catalogue records.

Order tracking uses the reference's stacked input/button layout and a product-image summary with ID, latest status, total and status badge. The existing verified-customer/owner access checks remain in place.
