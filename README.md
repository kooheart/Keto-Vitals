# Keto Vitals — e-commerce store (Weight Management, India)

A full-stack storefront + admin dashboard built with **Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS · PostgreSQL · Prisma 6**, with Razorpay payments and Cash on Delivery. Prices are in **INR (₹)**, stored as integer paise.

> **Status:** the application builds, starts, and passes its automated test suites in the development sandbox (see [Testing](#testing)). Several external integrations could **not** be exercised against the real services from that sandbox — see [Known limitations](#known-limitations-and-things-not-verified) before going live.

---

## 1. Assumptions & decisions

| Topic | Decision |
|---|---|
| Reference site | The Amazon.in store page was **not reachable** from the build environment (egress blocked), so the design follows the written requirements. The result is an original brand (name, logo mark, palette, artwork) — nothing from Amazon is used. |
| Auth | Own implementation: bcrypt-hashed passwords, random opaque session tokens (only a SHA-256 hash is stored), `httpOnly`/`SameSite=Lax` cookies. Chosen over a hosted provider to keep the project self-contained. |
| Payments | Razorpay REST API called directly with `fetch` (no SDK) so signature/amount checks are explicit and testable. |
| Images | No stock photos (no licensing risk). Product/category/banner art is **generated SVG** (`npm run assets:generate`). Admin uploads (JPEG/PNG/WebP) go to local disk or Cloudinary. |
| Tax | Prices are GST-inclusive (Indian retail norm). The GST contained in each order is computed per line and stored for reporting; it is **not** a GST invoice. |
| Search | PostgreSQL queries via Prisma (`ILIKE` over name/brand/description/tags/category). No external search service needed at this scale. |
| Fonts | System font stack (build does not depend on Google Fonts). |
| Policies | `/policies/*` pages are **draft templates** with `[PLACEHOLDERS]` — they must be completed and reviewed by your legal owner. |

## 2. Project structure

```
prisma/
  schema.prisma          # data model (users, roles, catalogue, inventory, carts, orders, payments, coupons, …)
  migrations/            # SQL migrations
  seed.ts, catalog-data.ts  # idempotent seed: roles, admin, 11 categories, 27 products, coupons, zones, banners
scripts/generate-assets.ts  # generates the SVG artwork in /public
src/
  app/
    (shop)/              # storefront pages: home, category, search, collections, product, cart, checkout,
                         #   order, track, wishlist, account/*, policies/*
    (auth)/              # login, register, forgot/reset password, verify email
    admin/               # protected dashboard (+ server actions in admin/actions.ts)
    api/                 # route handlers: auth, cart, checkout, webhooks/razorpay, cron, search, …
    sitemap.ts, robots.ts
  components/            # ui/ (design-system primitives), store/, admin/
  lib/                   # business logic (framework-agnostic where possible)
    pricing.ts           # pure totals/discount/GST maths            ← unit tested
    coupons.ts           # coupon rules                              ← unit tested
    cart.ts              # cart, stock clamping, guest merge
    orders.ts            # placeOrder, payment confirmation, cancel, status changes, expiry
    razorpay.ts          # gateway client + HMAC verification
    catalog.ts           # search/filter/sort/suggest queries
    auth/                # sessions, passwords, permissions (RBAC), account flows
tests/
  unit/ integration/ e2e/   # Vitest (unit + DB integration) and Playwright
```

## 3. Local setup

**Requirements:** Node ≥ 20, PostgreSQL ≥ 14, npm.

```bash
# 1. Install
npm install

# 2. Configure
cp .env.example .env          # then edit values (see §4)

# 3. Create the database (example)
createdb keto_vitals          # and a user, or use any Postgres URL in DATABASE_URL

# 4. Apply migrations + generate Prisma client
npx prisma migrate deploy     # (or `npm run db:migrate` during development)

# 5. Seed demo data (idempotent; safe to re-run)
npm run db:seed

# 6. Run
npm run dev                   # http://localhost:3000
```

The seed creates the admin account from `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`. It never overwrites an existing admin's password and **never creates reviews or orders**.

### Useful commands

| Command | Purpose |
|---|---|
| `npm run dev` / `build` / `start` | Develop / production build / serve |
| `npm run typecheck` | TypeScript check |
| `npm run db:migrate` | Create & apply a migration in dev |
| `npm run db:deploy` | Apply existing migrations (CI/production) |
| `npm run db:seed` | Seed demo catalogue |
| `npm run assets:generate` | Regenerate the SVG artwork in `/public` |
| `npm test` · `test:unit` · `test:integration` · `test:e2e` | Test suites |

## 4. Environment variables

See `.env.example` (names only — no secrets are committed).

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `APP_URL` | yes | Public base URL (used in emails, sitemap, canonical URLs) |
| `APP_SECRET` | yes | Random string; signs guest order-access links |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` | seed only | First admin user |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | for online payment | Use **test** keys while developing. Without them, online payment is hidden/disabled and only COD works. |
| `RAZORPAY_WEBHOOK_SECRET` | for webhooks | Must match the secret set on the Razorpay webhook |
| `SMTP_*`, `EMAIL_FROM` | optional | Without SMTP, emails are **logged to the server console and not sent**. |
| `STORAGE_DRIVER`, `CLOUDINARY_*` | optional | `local` (default) or `cloudinary` |
| `CRON_SECRET` | for cron | Bearer token for `/api/cron/release-stock` |
| `TEST_DATABASE_URL`, `E2E_DATABASE_URL` | tests | Dedicated databases (names must contain `test`/`e2e`) |
| `POLICY_REVIEWED` | optional | Set `true` after legal review to hide the "draft" notice on policy pages |

### External services needing credentials
- **Razorpay** (payments) — create test keys at the Razorpay dashboard; add a webhook to `https://<your-domain>/api/webhooks/razorpay` with events `payment.captured`, `payment.failed`, `order.paid`, and put its secret in `RAZORPAY_WEBHOOK_SECRET`.
- **SMTP provider** (email) — any SMTP service.
- **Cloudinary** (optional image storage) — recommended on serverless hosts, where local disk is ephemeral.
- **India Post PIN API** (`api.postalpincode.in`) — public, no key; used best-effort to fill city/state. Checkout never depends on it.

## 5. Payment flow & security model

1. Checkout posts address + payment method + an **idempotency key**. The server re-reads the cart, **re-prices from the database**, validates PIN serviceability, coupon, COD rules and stock; the browser never supplies prices.
2. In one DB transaction it atomically decrements stock (`UPDATE … WHERE quantity >= n`), snapshots item prices into `OrderItem`, records coupon use, and creates the order. A repeated/concurrent submit with the same key returns the same order.
3. Online payments: a Razorpay order is created **server-side**. Order stays `PENDING_PAYMENT` (stock held).
4. After Razorpay Checkout, the browser calls `/api/checkout/verify`. The server verifies the **HMAC signature**, then **fetches the payment from Razorpay** and checks `order_id`, `status === captured` and **amount** before marking paid. The browser's "success" alone never marks an order paid.
5. `/api/webhooks/razorpay` verifies the signature over the **raw body**, dedupes by event id, and applies the same idempotent `applyPaymentSuccess` (only one caller can win; `providerPaymentId` is unique).
6. Unpaid online orders are cancelled and stock released after 30 min by `/api/cron/release-stock` (call it every ~10 min; `Authorization: Bearer $CRON_SECRET`). A payment arriving after cancellation is recorded and flagged **"refund required"** in the admin order page.
7. Card data never touches this server.

Other controls: Zod validation on every input; RBAC checked inside every admin page *and* server action (not just hidden buttons); ownership checks on addresses/orders (no IDOR); same-origin (CSRF) check on mutating API routes + `SameSite=Lax`; in-memory rate limiting on login/register/reset/coupon/track/etc.; security headers incl. CSP; magic-byte upload validation; no secrets in client bundles; error responses don't leak internals; password reset invalidates all sessions; login timing equalised for unknown emails.

## 6. Testing

```bash
npm run test:unit          # pure logic: pricing, coupons, status machine, signatures, validation, query parsing
npm run test:integration   # real PostgreSQL (TEST_DATABASE_URL): cart, checkout, payments, webhooks, search, auth, admin authz, orders, reviews
npm run build && npm run test:e2e   # Playwright against a production server + dedicated seeded DB (E2E_DATABASE_URL)
```

Create the databases first, e.g. `createdb keto_vitals_test && createdb keto_vitals_e2e`. Integration tests apply migrations automatically; the e2e runner migrates, truncates and seeds its own database. Both refuse to run against databases whose name doesn't contain `test`/`e2e`.

Covered: authentication · search/filter/sort/pagination · cart calculations & merge · coupon validation · stock validation & overselling race · checkout totals · payment verification (forged signature, wrong amount, wrong order, replay) · duplicate-order prevention (concurrent submits) · webhook signature/dedupe · admin authorization · order status transitions & restock on cancel · responsive layout (no horizontal overflow at 375/768/1280 px, mobile menu) · guest checkout → confirmation → tracking · admin order/inventory/coupon/product workflows.

Payment tests use an in-memory fake gateway (no network). Real Razorpay was not contacted.

## 7. Deployment (Vercel + managed Postgres)

1. Provision PostgreSQL (Neon, Supabase, RDS, …) and set `DATABASE_URL` (use the pooled URL for serverless if offered).
2. Import the repo in Vercel; set all env vars from §4 (`APP_URL` = your production URL, `STORAGE_DRIVER=cloudinary` + Cloudinary vars because Vercel's disk is ephemeral).
3. Build command `npm run build` (runs `prisma generate`). Run `npx prisma migrate deploy` against the production DB as a release step, then `npm run db:seed` **once** (or create roles/admin manually — roles `customer`/`manager`/`admin` must exist).
4. Add a Vercel Cron (or any scheduler) hitting `/api/cron/release-stock` every 10 minutes with the bearer secret.
5. Configure the Razorpay webhook (§4) and switch from test to live keys only after completing Razorpay's activation.
6. Replace placeholder content: logo (`public/logo-mark.svg`), product art, store contact details (Admin → Shipping & payments), and complete/review the policy pages.

Any Node host works (`npm run build && npm start`); put it behind HTTPS (cookies are `Secure` in production).

## 8. Replacing placeholder images
Upload real photos per product in **Admin → Products → (product) → Images**. Category/collection/banner images can be uploaded in their admin pages. The generated SVGs live in `public/{products,categories,collections,banners}` and are only referenced by seed data.

## 9. Implemented features (summary)

**Storefront:** announcement bar · header with live search suggestions · category dropdown nav (+ mobile drawer) · hero carousel (admin-managed) · featured categories · best sellers / new arrivals / special offers · mid-page promo banners · featured collections · approved-review testimonials (hidden until real reviews exist) · newsletter · footer with policies/contact/payment methods · category, search & collection listings with URL-driven filters (category, price, availability, rating, type, attributes), sorting, pagination, empty/loading/error states, breadcrumbs · product page with gallery + zoom, variants, stock, quantity, Add to cart / Buy now, wishlist, PIN-code serviceability + ETA, specs, verified-purchase reviews, related & frequently-bought-together · cart (server-priced, stock-validated, coupons, shipping, GST, guest persistence, merge on login) · guest & signed-in checkout with saved addresses, Razorpay + COD · order confirmation, signed guest links, order tracking · account (profile, addresses, orders, wishlist, password change, email verification, password reset).

**Admin (`/admin`, role-based):** overview metrics · orders (search, filter, status workflow with tracking) · products (create/edit/archive/delete, variants, pricing/MRP/discount, image upload) · inventory & low-stock · categories & collections · customers (disable accounts — admin only) · coupons · review moderation · homepage banners · shipping zones, COD & store settings · sales reports with date filter.

**SEO:** clean URLs, per-page titles/descriptions, canonicals (filtered/search pages are `noindex`), Open Graph, Product + Breadcrumb JSON-LD (no ratings emitted unless real approved reviews exist), `sitemap.xml`, `robots.txt`.

## Known limitations and things not verified

Please read these before launch.

- **Not verified against live services** (blocked in the build sandbox): the Razorpay API/Checkout, the India Post PIN lookup, real SMTP delivery, and the Cloudinary upload driver. The code follows each provider's documented contract and the payment logic is covered with fakes, but you must run an end-to-end test with Razorpay **test keys** and your SMTP/Cloudinary credentials before going live.
- **Reference page not studied** — Amazon.in was unreachable; the design is original and based on the written brief.
- **Rate limiting is in-memory** (per server instance). Use a shared store (Redis/Upstash) for multi-instance deployments.
- **Refunds are manual**: cancelled-but-paid and returned orders must be refunded in the Razorpay dashboard, then marked *Refunded* in admin. No automated refund API calls.
- **Local image uploads** don't persist on serverless hosts — use Cloudinary (or another object store) in production.
- **No GST invoice generation**, no courier API integration (tracking number is entered manually), no stock-reservation timer beyond the 30-minute unpaid-order expiry.
- **Wishlist requires an account** (no guest wishlist). Reviews require sign-in and moderation.
- **No admin UI to create staff users or change roles** — assign roles via the database (`User.roleId` → `Role`). Permissions are defined in `src/lib/auth/permissions.ts`.
- **Email verification is not enforced** for login or checkout (the flow exists and the account page shows status).
- **Policies and legal text are templates**; the sample catalogue copy deliberately avoids health claims but should be reviewed for FSSAI/regulatory compliance before sale.
- **Prisma safety guard:** `prisma migrate reset` is intentionally not used by the tooling here (Prisma blocks it for AI agents); the e2e runner truncates its dedicated database instead. You can still run `npm run db:reset` yourself on a dev database.
- Responsive testing checks for overflow and navigation; there is no visual-regression suite and no cross-browser matrix (Chromium only).
- A static `eslint` config is not included; `npm run typecheck` and the test suites are the quality gates.
