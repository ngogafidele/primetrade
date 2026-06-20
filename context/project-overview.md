# Project Overview

## About The Project

Prime Trade Inventory is a single-store operations system for Prime Trade Company Ltd. It manages product inventory, sales, returns, expenses, invoices, proformas, loans/outstanding balances, stock adjustments, low-stock alerts, reports, and staff access in one business context.

The app is built with Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4, shadcn/radix-nova UI primitives, MongoDB with Mongoose, and custom JWT cookie authentication.

---

## The Problem It Solves

The business needs one trusted place for day-to-day stock and sales operations:

- Track products, quantities, costs, selling prices, and suppliers.
- Record sales while preserving stock accuracy.
- Review staff-entered sales, expenses, and proformas before approval.
- Generate invoices, proformas, receipts, catalogs, outstanding reports, and operational reports as PDFs.
- Monitor low stock, below-cost sales, pending approvals, and due or overdue loans.
- Give admins visibility into cost, profit, stock value, and staff activity while keeping sensitive cost metrics away from non-admin users.

---

## Pages

```text
/                         -> Login page
/setup-admin              -> One-time admin setup
/reset-password           -> Password reset flow
/dashboard                -> Admin business overview and analytics
/products                 -> Product catalog, product creation/editing, restock/supply records
/sales                    -> Sales entry, approval, invoices, sales PDFs
/loans                    -> Outstanding unpaid sales and loan follow-up
/returns                  -> Return and replacement transactions
/expenses                 -> Expense entry and approval
/invoices                 -> Sales invoices and proformas
/alerts                   -> Low-stock alert review
/stock-adjustments        -> Admin stock corrections
/users                    -> Admin user management and login activity
/reports                  -> Admin operational reports and PDF export
```

---

## Navigation

Authenticated pages use a top header plus a left sidebar.

Admin sidebar:

```text
Dashboard
Users
Stock Adjustments
Products
Sales
Loans
Returns
Expenses
Invoices
Low Stock Alerts
Reports
```

Staff and manager sidebar:

```text
Products
Sales
Loans
Returns
Expenses
Invoices
Low Stock Alerts
```

There is no store switcher. All data belongs to the same business context.

---

## Core User Flow

### First Run

- A user visits the login page.
- If the system has no admin, the setup flow creates the first admin account.
- Setup immediately signs in the admin with the same JWT cookie session flow as login.

### Daily Login

- Staff or admin signs in with email and password.
- The login route validates the user, checks `isActive`, records a login log, prunes old login logs, and sets the `auth` cookie.
- `proxy.ts` refreshes session activity on each protected request.
- Admin sessions expire after 1 hour of inactivity; staff sessions expire after 6 hours.

### Inventory Management

- Admin creates products. SKUs are generated from product names.
- Products may be created one at a time or in batches.
- Product quantities, unit costs, selling prices, suppliers, and supply dates are recorded.
- Restocks create `ProductSupply` records.
- Low-stock alerts are synced when product quantities or thresholds change.
- Deleted products are soft-deleted, not physically removed from the catalog flow.

### Sales

- Authenticated users can record sales.
- Admin sales are approved immediately and decrement stock immediately.
- Non-admin sales are stored as pending and await admin approval.
- Sales can be paid or unpaid. Unpaid sales carry customer and payment-date details and appear in loans/outstanding workflows.
- Below-cost sale information is visible to admins through notifications and sensitive serialized fields.
- Sales can generate invoices and sales-list PDFs.

### Returns

- Returns record returned items and optional replacement items.
- Return totals are accounted for in revenue and dashboard calculations.
- Return receipts can be exported as PDFs.

### Expenses

- Expenses can be recorded with title, amount, category, vendor, notes, and incurred date.
- Admin-created expenses are approved immediately; staff/manager expense behavior follows the approval helpers.
- Dashboard daily profit calculations subtract approved expenses.

### Invoices And Proformas

- Invoices can originate from sales or proformas.
- Proformas can be approved and converted into invoice-style documents.
- Number sequences generate month-scoped invoice/proforma numbering.
- PDF routes generate invoices and proformas.

### Dashboard And Reports

- Admin dashboard reads live MongoDB aggregates.
- Admin-only metrics include stock value, cost of sales, gross profit, and return cost.
- Reports and PDF exports use server-side PDFKit generators.

---

## Data Architecture

### Single Store Model

PrimeTrade intentionally does not scope records by store or location. Products, sales, returns, invoices, alerts, users, expenses, and reports all operate in one business context.

### Sensitive Cost Data

Cost price, stock value, cost of sales, gross profit, and below-cost warnings are admin-sensitive. Server responses should serialize these fields only when `session.isAdmin` permits it.

### Approval Model

Some operational records are immediately approved for admins and pending for non-admin users:

- Sales
- Expenses
- Proformas

Approved records drive dashboard totals, reports, and normal list views. Pending records are surfaced to admins through header notifications and approval UI.

### Soft Delete Model

Products, sales, and invoices use `deletedAt` and related metadata. Normal reads must apply `activeRecordFilter` or a domain-specific approved/active filter.

---

## Features In Scope

- One-time admin setup
- Email/password login
- Password reset by email token
- Role-based access for admin, manager, and staff
- Product catalog and restocking
- Batch product creation
- Low-stock alert sync
- Sales creation, approval, editing, soft delete, invoice creation
- Unpaid sales and loan tracking
- Returns and replacement tracking
- Expense tracking and approval
- Invoices and proformas
- Header notifications for admin operational risk
- Dashboard statistics and recent activity
- Reports and PDF exports
- Login log tracking

---

## Features Out Of Scope

- Multi-store/location support
- Product images
- Self-signup
- Public ecommerce storefront
- Barcode scanning unless explicitly added
- Payment gateway integration
- Real-time collaboration
- External accounting integration
- Mobile app
- Multi-tenant accounts

---

## Target Users

- Admin/operator who owns inventory, cost visibility, approvals, users, and reports.
- Manager or staff who records daily operational activity such as sales, returns, expenses, and invoices.

---

## Success Criteria

- Staff can record common sales quickly and accurately.
- Admin can see business health, pending approvals, stock risks, and outstanding loans from the dashboard/header.
- Product stock remains consistent after sales, approvals, returns, restocks, and adjustments.
- Sensitive cost and profit data is visible only to admins.
- PDF exports match the operational record users expect.
- All writes are validated and recover cleanly from partial failures.
