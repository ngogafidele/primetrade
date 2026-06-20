# Progress Tracker

Update this file after completed features or meaningful architecture changes.

---

## Current Status

Phase: Production-style operational app with context documentation added.

Last completed: Product SKU generation now reserves SKUs from soft-deleted products.

Next: No active feature. Future work should start by reading this context folder and `AGENTS.md`.

---

## Progress

### Foundation

- [x] Next.js 16 App Router application
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

---

## Known Gaps / Caution Areas

- Dashboard metric cards currently use raw hex classes. Future UI work should tokenize these.
- The existing documentation in `COPILOT.md` is older than the current implementation and omits returns, expenses, loans, proformas, approval flows, and reports.
- No formal test suite is visible. Use lint/build and focused manual workflow checks until tests are added.
- Git reports dubious ownership for this repo under the current user; avoid relying on git status unless safe.directory is configured by the user.

---

## Verification Notes

Multi-item loan statement rows were refined so item lines remain separate while shared transaction details print only on the first item row. Full `npm.cmd run lint` and focused ESLint previously did not complete within the command timeout; `npx.cmd tsc --noEmit --pretty false` still reports pre-existing unrelated project type errors.
