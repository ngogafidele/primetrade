# Architecture

## Stack

| Layer | Tool | Purpose |
| --- | --- | --- |
| Framework | Next.js 16 App Router | Full-stack routing, Server Components, Route Handlers |
| UI | React 19 | Client and server UI |
| Styling | Tailwind CSS v4, shadcn/radix-nova | Token-driven operations UI |
| Database | MongoDB | Persistent operational data |
| ODM | Mongoose | Schemas, indexes, queries, aggregates |
| Auth | JWT cookie plus MongoDB users | Email/password sessions and role checks |
| Validation | Zod | Request validation |
| Passwords | bcrypt | Password hashing |
| PDFs | PDFKit | Receipts, invoices, catalogs, reports, outstanding exports |
| Email | Resend integration | Password reset email |
| Icons | lucide-react | UI icons |
| Language | TypeScript strict | Application code |

---

## Folder Structure

```text
/
|-- AGENTS.md
|-- context/
|-- app/
|   |-- layout.tsx
|   |-- page.tsx
|   |-- setup-admin/
|   |-- reset-password/
|   |-- (dashboard)/
|   |   |-- layout.tsx
|   |   |-- dashboard/
|   |   |-- products/
|   |   |-- sales/
|   |   |-- loans/
|   |   |-- returns/
|   |   |-- expenses/
|   |   |-- invoices/
|   |   |-- alerts/
|   |   |-- stock-adjustments/
|   |   |-- users/
|   |   |-- reports/
|   |-- api/
|       |-- auth/
|       |-- dashboard/stats/
|       |-- products/
|       |-- product-supplies/
|       |-- sales/
|       |-- sales-invoices/
|       |-- returns/
|       |-- expenses/
|       |-- invoices/
|       |-- proformas/
|       |-- alerts/
|       |-- stock-adjustments/
|       |-- users/
|       |-- reports/pdf/
|       |-- loans/pdf/
|       |-- outstanding/pdf/
|-- components/
|   |-- auth/
|   |-- dashboard/
|   |-- forms/
|   |-- layout/
|   |-- products/
|   |-- sales/
|   |-- returns/
|   |-- expenses/
|   |-- invoices/
|   |-- outstanding/
|   |-- reports/
|   |-- stock-adjustments/
|   |-- tables/
|   |-- ui/
|-- lib/
|   |-- auth/
|   |-- db/
|   |   |-- models/
|   |   |-- validators/
|   |-- email/
|   |-- pdf/
|   |-- products/
|   |-- utils/
|-- public/
|-- types/
|-- proxy.ts
```

---

## System Boundaries

| Folder | Owns |
| --- | --- |
| `app/(dashboard)` | Authenticated pages and dashboard layout composition |
| `app/api` | HTTP Route Handlers, request validation, auth checks, DB reads/writes |
| `components` | Client and server UI components; managers own interactive state and call API routes |
| `components/ui` | Shared shadcn/radix-nova primitives |
| `lib/auth` | JWT sessions, cookie helpers, route auth helpers, password hashing, password reset logic |
| `lib/db/models` | Mongoose schemas and indexes |
| `lib/db/validators` | Zod schemas for incoming payloads |
| `lib/db` | Shared DB business helpers such as approval filters, soft-delete filters, alert sync |
| `lib/pdf` | PDFKit document generation |
| `lib/products` | Product serialization and cost-field shaping |
| `lib/utils` | Formatting, dates, invoice numbers, calculations, API client helpers |
| `types` | Shared TypeScript types |

---

## Data Flow

### Authenticated Page

```text
Request
  -> proxy.ts refreshes/clears auth cookie
  -> dashboard layout calls requireServerSession()
  -> getCurrentSession() verifies user still exists and is active
  -> page loads MongoDB data
  -> AppShell renders header/sidebar/content
```

### Client Mutation

```text
User action in manager component
  -> fetch() to app/api route
  -> route calls requireAuth() or requireAdmin()
  -> route validates body with Zod
  -> route connects to MongoDB
  -> route performs Mongoose writes and compensation if needed
  -> route returns { success, data?, error? }
  -> component updates local state or router.refresh()
```

### Sales Approval And Stock

```text
Sale submitted
  -> CreateSaleSchema validates payload
  -> products loaded with activeRecordFilter
  -> sale items capture product name, sku, unit, basePrice, sellingPrice
  -> admin sale: decrement product quantities immediately
  -> staff sale: create pending sale without stock decrement
  -> approval route later decrements stock and syncs low-stock alerts
```

### Dashboard Stats

```text
DashboardStats client component
  -> GET /api/dashboard/stats
  -> route authenticates session
  -> route aggregates products, sales, returns, invoices, expenses
  -> admin-only cost/profit fields included only for admins
  -> component renders cards and tables
```

### PDF Export

```text
User clicks PDF export
  -> API route authenticates user
  -> route loads scoped operational data
  -> lib/pdf/* generator creates PDFKit document/buffer/stream
  -> response returns application/pdf with Content-Disposition filename
```

---

## Authentication

Provider: custom email/password auth.

Core files:

- `lib/auth/session.ts`
- `lib/auth/active-session.ts`
- `lib/auth/middleware.ts`
- `lib/auth/server.ts`
- `proxy.ts`

Session cookie:

```text
name: auth
httpOnly: true
sameSite: lax
secure: production only
```

Session payload:

```typescript
{
  userId: string;
  name?: string;
  email: string;
  isAdmin: boolean;
  role: "admin" | "manager" | "staff";
  loginLogId?: string;
  lastActivityAt: number;
}
```

Idle timeouts:

- Admin: 1 hour
- Staff/manager: 6 hours

Protected route behavior:

- `proxy.ts` runs for app routes and APIs except static assets.
- Invalid sessions clear the auth cookie.
- API requests receive `401`.
- Protected pages redirect to `/`.

---

## Permission Model

Roles:

- `admin`
- `manager`
- `staff`

Current helper behavior:

- `canViewAnalytics`: admin only
- `canManageUsers`: admin only
- `canManageProducts`: admin only
- `canManageCategories`: admin only
- `canRecordSales`: admin or any non-admin role

Admin-only sidebar items:

- Dashboard
- Users
- Stock Adjustments
- Reports

Common sidebar items:

- Products
- Sales
- Loans
- Returns
- Expenses
- Invoices
- Low Stock Alerts

---

## MongoDB Models

### User

Staff account with name, email, hashed password, `isAdmin`, `isActive`, role, last login/logout.

### UserLoginLog

Stores recent login/logout records. Old logs are pruned to the newest 50.

### Product

Product catalog record:

- name
- generated sku
- unit
- quantity
- low stock threshold
- cost price
- selling price
- optional category
- soft-delete metadata

Unique active indexes protect SKU and case-insensitive product name.

### ProductSupply

Restock/supply history for product, supplier, quantity, unit cost, supplied date, recorded user, notes.

### Category

Simple name and description catalog.

### Sale

Sales transaction with items, total, paid/unpaid state, payment method, approval status, sale date, approving user, creating user, notes, optional customer, optional outstanding details, and soft-delete metadata.

### ReturnTransaction

Return workflow with returned items, replacement items, total return amount, total replacement amount, creating user, and notes.

### Expense

Expense record with title, amount, category, vendor, notes, incurred date, creating user, and approval status.

### Invoice

Invoice generated from a sale or proforma, including invoice number, customer details, items, total, status, issue/due dates, and soft-delete metadata.

### Proforma

Proforma quote with generated number, customer details, approval status, items, total, issue date, and expiry.

### StockAdjustment

Admin stock correction with product, SKU, quantity change, reason, and adjusting user.

### Alert

Low-stock or custom alert with message, severity, product, resolution state, and resolution date.

### NumberSequence

Month-scoped sequence for invoice and proforma number generation.

### PasswordResetToken

Hashed reset token with expiry and used timestamp. Expired tokens are removed by TTL index.

---

## Important Invariants

- This is a single-store app. Do not add store/location scoping unless the product direction changes.
- All protected reads and writes must verify an active session.
- Admin-only routes must call `requireAdmin()`.
- Normal product reads must apply `activeRecordFilter`.
- Normal sales reads and dashboard revenue must apply `approvedSaleFilter` or `approvedSaleDateFilter`.
- Normal invoice reads must exclude soft-deleted invoices.
- Cost price, stock value, cost of sales, gross profit, and return cost must be admin-only.
- Stock-changing writes must sync low-stock alerts after successful quantity changes.
- Stock-changing writes should compensate/rollback when a later write fails.
- Passwords must always be hashed with `hashPassword`.
- Never expose raw auth, database, or email errors to users.
- Date inputs should use Kigali helpers from `lib/utils/time.ts`.
- API responses should use `{ success: boolean, data?: T, error?: string }`.
- Read Next.js 16 docs in `node_modules/next/dist/docs/` before editing Next-specific code.
