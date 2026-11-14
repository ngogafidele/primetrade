# Progress Tracker

Update this file after completed features or meaningful architecture changes.

---

## Current Status

Phase: Production-style operational app with context documentation added.

Last completed: Admin-managed website categories (Products → Website categories), 2026-11-14. Not yet run against the real database.

Next: No active feature. Future work should start by reading this context folder and `AGENTS.md`.

---

## Progress

### Foundation

- [x] Next.js 16 App Router application
- [x] Auth photo background on login and setup-admin pages
- [x] Tailwind CSS v4 and shadcn/radix-nova theme
- [x] MongoDB/Mongoose connection cache
- [x] JWT cookie auth
- [x] One-time admin setup
- [x] Login/logout
- [x] Login logs
- [x] Password reset
- [x] Protected route proxy

### Users And Access

- [x] User model
- [x] Admin/manager/staff roles
- [x] Active/inactive user handling
- [x] Admin user management
- [x] Admin-only dashboard/users/stock-adjustment/report navigation

### Inventory

- [x] Product model
- [x] Product manager UI
- [x] Batch product creation
- [x] Generated SKUs
- [x] Product supplies/restocks
- [x] Low-stock thresholds
- [x] Low-stock alerts
- [x] Soft-deleted products
- [x] SKU generation avoids reusing soft-deleted product SKUs
- [x] Product catalog PDF export
- [x] Products Excel export (admin, full active catalog)
- [x] Product website profile (admin): show/hide switch, category, brand, description, specifications
- [x] All active products on the public website by default; admins hide exceptions
- [x] Admin-managed website categories: add, rename, describe, reorder, delete (`/api/website-categories`)
- [x] Product image upload to Cloudflare R2 (admin, direct browser upload with signed URLs)
- [x] Public catalog endpoint for the public website (`GET /api/public/catalog`, token-protected)

### Sales And Stock

- [x] Sales model
- [x] Sales manager UI
- [x] Paid/unpaid sales
- [x] Outstanding/loan details
- [x] Admin immediate approval
- [x] Pending staff sales
- [x] Approval stock decrement
- [x] Low-stock alert sync
- [x] Sales soft delete
- [x] Sales list PDF
- [x] Sales list Excel export (admin, date range, item rows + summary sheet)

### Returns

- [x] Return transaction model
- [x] Returns manager UI
- [x] Replacement item support
- [x] Return receipt PDF
- [x] Dashboard revenue/profit return adjustments

### Expenses

- [x] Expense model
- [x] Expense manager UI
- [x] Approval status
- [x] Pending expense notifications
- [x] Dashboard daily expense totals

### Documents

- [x] Invoice model
- [x] Invoice routes
- [x] Sales invoice routes
- [x] Proforma model
- [x] Proforma routes
- [x] Number sequence model
- [x] Invoice PDF
- [x] Proforma PDF

### Dashboard And Reports

- [x] Dashboard stats API
- [x] Dashboard stats UI
- [x] Recent sales table
- [x] Top moving products table
- [x] Admin-sensitive cost/profit metrics
- [x] Header notifications
- [x] Reports page
- [x] Reports PDF route
- [x] Loans/outstanding PDF route
- [x] Loan statement item rows for multi-item transactions
- [x] Loan statement shared transaction details displayed once per transaction
- [x] Loans list newest-first ordering
- [x] Loans date/search filters
- [x] Loan installment payment recording
- [x] Loan installment payment made-date selection
- [x] Admin deleted-loan list and restore flow
- [x] Password confirmation for loan delete/restore actions
- [x] Loan notifications API
- [x] Dashboard outstanding amount uses unpaid sale remaining balances
- [x] Loan statement PDF dates use Kigali timezone formatting
- [x] Company stamp on invoice, proforma, return receipt, and loan statement PDFs

### Context Documentation

- [x] `context/project-overview.md`
- [x] `context/architecture.md`
- [x] `context/ui-tokens.md`
- [x] `context/ui-rules.md`
- [x] `context/ui-registry.md`
- [x] `context/code-standards.md`
- [x] `context/library-docs.md`
- [x] `context/build-plan.md`
- [x] `context/progress-tracker.md`
- [x] `context/designs/`

---

## Decisions Captured

- PrimeTrade is a single-store app. Do not add store-scoped logic by default.
- Custom JWT cookie auth is the source of session state.
- Active session validation checks MongoDB user state on protected requests.
- Admin idle timeout is shorter than staff timeout.
- Admin-only sensitive fields are serialized conditionally.
- Products, sales, and invoices use soft-delete conventions where implemented.
- Product SKU generation treats soft-deleted product SKUs as permanently reserved.
- Approved sales drive dashboard and report totals.
- Admin-created sales decrement stock immediately; non-admin sales wait for approval.
- Low-stock alerts must be synced after stock-changing operations.
- PDFs are server-generated with PDFKit.
- UI should remain compact and operational, using current theme tokens and shared primitives.
- The public website (primepublic) reads only `GET /api/public/catalog`. That route is the single unauthenticated-by-session data route; it requires `PUBLIC_CATALOG_TOKEN`, returns every active product except those with `website.isHidden: true` (products are public by default since 2026-11-14; the dialog's "Show on website" switch sets `isHidden`; the API payload still calls it `isPublished`), and builds responses through the `toPublicProduct` allow-list. Prices, cost, stock and supplier data must never be added to it without an explicit decision.
- Website categories are managed by admins (Products → Website categories) and stored in the `WebsiteCategory` collection; `lib/website/category-store.ts` is the only reader. `DEFAULT_WEBSITE_CATEGORIES` in `lib/website/categories.ts` is just the starting list: reads fall back to it while the collection is empty, and the admin routes copy it into the database on first use. A category's slug is fixed at creation (renames keep web addresses), deleting one clears `website.category` on its products, and the last category cannot be deleted. The old `Category` collection is still unused. A category is optional.
- Product images are stored in R2 by key (`products/<productId>/<uuid>.<ext>`); public URLs are built from `R2_PUBLIC_BASE_URL`. Soft-deleting a product keeps its images; removing an image deletes the R2 object.

---

## Known Gaps / Caution Areas

- Dashboard metric cards currently use raw hex classes. Future UI work should tokenize these.
- The existing documentation in `COPILOT.md` is older than the current implementation and omits returns, expenses, loans, proformas, approval flows, and reports.
- No formal test suite is visible. Use lint/build and focused manual workflow checks until tests are added.
- Git reports dubious ownership for this repo under the current user; avoid relying on git status unless safe.directory is configured by the user.

---

## Verification Notes

Website profile and image upload work (2026-11-13): `npm run build` completed successfully and ESLint is clean on the new files. Signed upload URL generation, the public product mapper (no price/cost/stock fields) and the validators were checked in isolation with sample data. The new routes and the Website dialog were not exercised against the database or a real R2 bucket; no local MongoDB or R2 credentials were available.

Multi-item loan statement rows were refined so item lines remain separate while shared transaction details print only on the first item row. Full `npm.cmd run lint` and focused ESLint previously did not complete within the command timeout; `npx.cmd tsc --noEmit --pretty false` still reports pre-existing unrelated project type errors.

Excel export work (2026-10-14): `npm run build` completed successfully, including the previously failing `/_global-error` prerender. Workbooks were verified by generating sample files and reading them back. The live routes were not exercised against the database.

Auth background work: `npm run build` compiles successfully, but static export fails while prerendering Next's internal `/_global-error` page with `InvariantError: Expected workStore to be initialized` — a Next.js internal issue unrelated to the login/setup-admin pages.
