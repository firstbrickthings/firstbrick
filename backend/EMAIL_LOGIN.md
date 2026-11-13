# Email OTP migration

The website's Python API manages email verification and MySQL accounts/sessions. Gmail sends codes through HTTPS; no SMTP port or Firebase SMS service is used by email login.

Deployment alone does not authorize a Gmail mailbox. Until mailbox authorization and owner email verification succeed, the existing verified phone login stays available. `/api/auth/config` reports the actual state. There are no demo codes in production.

## Connect the store mailbox

The configured sender is `babyonestores@gmail.com`. Its owner must authorize Google access; a service-account JSON cannot impersonate this personal Gmail mailbox.

1. In Google Cloud for the store project, enable Gmail API. Create/configure a Google Auth Platform consent screen and a **Web application** OAuth client. Request `openid`, `email`, and `https://www.googleapis.com/auth/gmail.send` only. Follow Google's consent/publishing requirements. A refresh token granted while an external app is in Testing can expire after seven days; use the appropriate production configuration for ongoing store delivery.
2. Register the exact redirect URI shown in **Dashboard → Login & email**. For this deployment it is `https://babyone-web-test.up.railway.app/api/auth/gmail/callback`.
3. Save `GMAIL_OAUTH_CLIENT_ID` and `GMAIL_OAUTH_CLIENT_SECRET` privately in Railway's `babyone-web` service and deploy. `AUTH_SECRET` must contain a strong random value of at least 32 characters; it is provisioned separately and must be backed up securely. Do not put credentials in HTML, GitHub, chat, screenshots, or the product dashboard.
4. As the current verified owner, open **Dashboard → Login & email → Connect Gmail** and authorize the configured store account. The callback verifies Google's signed email identity. A different mailbox is rejected. Its refresh credential is encrypted before saving in MySQL; access tokens are used only in memory.
5. Phone-only customers should use **Account → Link email to this account** before the final switch. This verifies their email while retaining the same customer ID, cart and order history.
6. On the existing owner account, select **Verify owner email & switch login**. A successfully delivered and verified owner code keeps the owner's customer ID, activates the cookie session, and retires Firebase authentication for the website. Newly loaded pages stop requesting the Firebase SDK. Existing Firebase project resources are not deleted.

Only a verified email in the server's explicit `ADMIN_VERIFIED_EMAILS` list or a previously trusted owner identity can receive dashboard access. An entered name or phone number never grants access.

## Existing customer ownership

Old customer IDs, orders, products, payment records and saved bags are preserved. An email typed previously into a shipping form is not proof of email ownership and is **not** used to merge accounts automatically. A newly entered delivery phone is not proof of phone ownership and cannot unlock historical phone-only orders. After cutover, a phone-only customer who did not link beforehand needs store-assisted recovery after ownership review; the records are retained.

## Delivery and payment

The current temporary delivery configuration remains a fixed INR 99 per order. Existing catalogue prices and inventory are preserved by this migration. A product priced at INR 10 therefore totals INR 109 for quantity one. The normal order/payment verification and signed Razorpay webhooks remain active. Development tests use fake mail and payment providers; the owner must approve a real UPI purchase personally and check capture/settlement in Razorpay.

## Security and operation

Codes expire after five minutes, are device-bound and single use, allow five attempts, and are stored only as keyed digests. Requests have per-email, peer and mailbox limits and a resend cooldown. Codes and provider credentials are never logged. Gmail quotas and revocation can interrupt delivery; the dashboard reports connection state and actual send failures.

Login sessions use random secrets stored only as SHA-256 digests in MySQL and HttpOnly, Secure, SameSite=Lax, host-only cookies in production. Mutations require a session-bound CSRF header and an allowed Origin. A browser profile or localStorage is never authorization. Production cookies use the `__Host-` prefix. `AUTH_COOKIE_SECURE=false` is for isolated local HTTP tests only.

The schema migration stores a private pre-change database snapshot. `AUTH_SECRET` is required to decrypt Gmail refresh credentials and must be restored together with database backups. Rotating it invalidates CSRF values and requires reconnecting Gmail. Do not remove Firebase credentials or delete the old project until the verified email cutover has been completed and recovery needs reviewed.

The fake email endpoint in `backend.tests.browser_server` requires an explicitly named `*_test` database and `BABYONE_EMAIL_BROWSER_TEST=1`; it is never imported by the production entry point `app.serve`.
