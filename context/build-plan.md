# Build Plan

This file records the current feature surface and recommended future build order. PrimeTrade is already a working application; this is not a from-scratch plan.

---

## Core Principle

Every feature should preserve operational correctness before visual polish:

1. Validate input.
2. Authenticate and authorize.
3. Update stock/money records safely.
4. Serialize sensitive fields by role.
5. Render a compact, scannable UI.
6. Verify with lint/build and any focused manual workflow checks.

---

## Phase 1 - Foundation

### 01 App Shell And Auth

Status: complete.

Includes:

- Root layout with Geist fonts and global theme.
- Login page.
- One-time admin setup.
- JWT cookie sessions.
- Active-session lookup against Mongo users.
- Login logs.
- Logout flow.
- Password reset flow.
- Protected route handling in `proxy.ts`.

### 02 Single Store Model

Status: complete.

Includes:

- No store/location selector.
- No store-scoped filters.
- Shared business context for all records.

---

## Phase 2 - Inventory

### 03 Product Catalog

Status: complete.

Includes:

- Product create/edit.
- Batch product creation.
- Generated SKU.
- Unit, quantity, threshold, cost price, selling price.
- Supplier and restock history.
- Soft delete.
- Admin-sensitive cost fields.

### 04 Low Stock Alerts

Status: complete.

Includes:

- Alert model.
- Alert sync on product and stock changes.
- Low stock alert page.
- Header notification source.

### 05 Stock Adjustments

Status: complete.

Includes:

- Admin stock adjustment page.
- Adjustment records with product, SKU, quantity change, reason, adjusting user.

---

## Phase 3 - Sales Operations

### 06 Sales Entry

Status: complete.

Includes:

- Multi-item sales.
- Product search select.
- Paid/unpaid payment states.
- Payment method.
- Customer details.
- Sale date.
- Below-cost awareness for admin.

### 07 Sale Approval

Status: complete.

Includes:

- Admin-created sales approve immediately.
- Non-admin sales stay pending.
- Approval updates stock.
- Header notifications for pending and below-cost sales.

### 08 Loans / Outstanding

Status: complete.

Includes:

- Unpaid sales with customer and payment date.
- Loans page.
- Due and overdue header notifications.
- Outstanding PDF export.

### 09 Returns

Status: complete.

Includes:

- Return items.
- Replacement items.
- Return totals.
- Return receipt PDF.
- Dashboard revenue adjustments.

---

## Phase 4 - Documents

### 10 Invoices

Status: complete.

Includes:

- Invoices from sales.
- Invoice status.
- Soft delete.
- Sales invoice APIs.
- Invoice PDF route.

### 11 Proformas

Status: complete.

Includes:

- Proforma records.
- Proforma approval.
- Proforma PDF route.
- Proforma-to-invoice source support.

### 12 Number Sequences

Status: complete.

Includes:

- Month-scoped sequences for invoice and proforma numbers.

---

## Phase 5 - Expenses And Reports

### 13 Expenses

Status: complete.

Includes:

- Expense entry.
- Expense approval.
- Dashboard daily expense totals.
- Header notifications for pending expenses.

### 14 Reports

Status: complete.

Includes:

- Reports page.
- Report PDF export.
- Product catalog PDF export.
- Sales list PDF export.
- Loans/outstanding PDF export.

---

## Phase 6 - Dashboard

### 15 Dashboard Stats

Status: complete.

Includes:

- Product count.
- Low stock count.
- Sales count.
- Sales today.
- Revenue and revenue today.
- Admin-only stock value.
- Admin-only cost/profit fields.
- Expenses today.
- Outstanding amount.
- Recent sales.
- Top moving products with return adjustments.

### 16 Header Notifications

Status: complete.

Includes:

- Pending sales.
- Below-cost sales.
- Pending proformas.
- Pending expenses.
- Below-cost products.
- Due loans.
- Overdue loans.

---

## Future Improvement Candidates

These are not active scope unless requested.

### 17 Tokenize Dashboard Metric Colors

Replace raw dashboard card color classes with semantic theme tokens.

### 18 Add Focused Test Coverage

Add tests around:

- Sale stock decrement and rollback.
- Sale approval stock updates.
- Product creation duplicate handling.
- Dashboard aggregate calculations.
- Role-based serialization of cost fields.

### 19 Strengthen Audit Views

Expose clearer audit history for:

- Deleted products/sales/invoices.
- Stock adjustments.
- Approval actions.
- Login logs.

### 20 Improve Report Filtering

Add richer report filters if business workflows require them:

- Date range presets.
- Product/category filters.
- Staff filters.
- Payment status filters.

---

## Verification Standard

For future implementation work:

```bash
npm run lint
npm run build
```

If build requires network access because of `next/font`, rerun with approved network access rather than changing font behavior.
