# UI Registry

Living document for PrimeTrade UI patterns. Update this file when adding or materially changing UI components.

---

## App Shell

File: `components/layout/app-shell.tsx`

| Property | Pattern |
| --- | --- |
| Page background | `min-h-screen bg-background` |
| Header | `sticky top-0 z-30 border-b border-border/80 bg-card/90 backdrop-blur` |
| Header inner | `mx-auto flex max-w-[96rem] ... px-3 py-2.5 sm:px-4 sm:py-3 lg:px-5` |
| Logo box | `size-12 rounded-xl border border-border bg-white p-1.5 shadow-sm` |
| User chip | `rounded-xl border border-border bg-background px-3 py-2 shadow-sm` |
| Main row | `mx-auto flex max-w-[96rem] flex-col gap-3 px-3 py-3 ... md:flex-row` |
| Content panel | `flex-1 rounded-2xl border border-border/80 bg-card/95 p-3 shadow-sm backdrop-blur-sm sm:p-4 lg:p-4` |

Pattern notes:

Use `AppShell` for all authenticated routes. It owns header, sidebar, notifications, user chip, and logout placement.

---

## Sidebar

File: `components/layout/sidebar.tsx`

| Property | Pattern |
| --- | --- |
| Shell | `w-full shrink-0 rounded-2xl border border-sidebar-border bg-sidebar/90 p-3 backdrop-blur-sm md:sticky md:top-6 md:h-fit md:w-64` |
| Eyebrow | `text-xs uppercase tracking-[0.2em] text-muted-foreground` |
| Active link | `bg-primary text-primary-foreground shadow-sm` |
| Inactive link | `text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground` |
| Link shape | `flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition` |

Pattern notes:

Admin sessions get dashboard, users, stock adjustments, common items, and reports. Non-admin sessions get common items only.

---

## Login Page

File: `app/page.tsx`

| Property | Pattern |
| --- | --- |
| Background | Full-screen radial gradient using blue/red/amber utility overlays |
| Layout | `grid min-h-screen max-w-6xl ... lg:grid-cols-[1.05fr_0.95fr]` |
| Login card | `rounded-xl border border-border/80 bg-card p-5 shadow-xl sm:p-7` |
| Feature cards | `rounded-lg border border-border/80 bg-white/70 p-4 text-sm font-medium shadow-sm` |
| Inputs | `Input` with icon absolute left and `h-11` |
| Primary submit | `Button className="h-11 w-full"` |

Pattern notes:

Public login uses more visual branding than operational screens. Keep setup link visible from this page.

---

## Dashboard Stats

File: `components/dashboard/dashboard-stats.tsx`

| Property | Pattern |
| --- | --- |
| Loading | `DashboardSkeleton` |
| Metric grid | `grid gap-x-5 gap-y-12 md:grid-cols-2 xl:grid-cols-6` |
| Metric card | `rounded-2xl border border-border/80 ... p-4 text-black shadow-sm` |
| Section card | `rounded-2xl border border-border/80 bg-card p-4 shadow-sm` |
| Section heading | Eyebrow `text-xs uppercase tracking-[0.18em] text-muted-foreground`, title `text-lg font-semibold` |
| Tables | Shared `Table` primitives |

Pattern notes:

Dashboard is admin-first. Cost/profit metrics are conditionally present only when the API returns admin fields.

---

## Product Manager

File: `components/products/products-manager.tsx`

| Property | Pattern |
| --- | --- |
| State owner | Client component with local records, dialogs, pagination, and form state |
| Pagination | 20 products per page |
| Batch create limit | 50 products per create flow |
| Date inputs | `formatKigaliDateInput(new Date())` |
| Currency | `formatCurrency` |
| Tables | Shared table primitives inside operational cards |
| Dialogs | Existing dialog primitives for create/edit and supply |

Pattern notes:

Product manager handles active and deleted product lists, create/edit, restock, pagination, and warnings when admin sees price below cost.

---

## Sales Manager

File: `components/sales/sales-manager.tsx`

| Property | Pattern |
| --- | --- |
| State owner | Client component with sale draft rows, dialogs, approval state, PDF state, search, pagination |
| Pagination | 20 sales per page |
| Product selection | `ProductSearchSelect` |
| Date defaults | Month-to-today PDF range from Kigali date helpers |
| Payment states | `paid` and `unpaid` |
| Payment methods | `cash`, `mobile-money`, `bank` |
| Outstanding details | customer name, customer phone, payment date |

Pattern notes:

Sales manager is dense by design. It coordinates sale creation, edits, delete reason, invoice creation, outstanding capture, approvals, and PDF downloads.

---

## Button Primitive

File: `components/ui/button.tsx`

Variants:

- `default`
- `outline`
- `secondary`
- `ghost`
- `destructive`
- `link`

Sizes:

- `default`
- `xs`
- `sm`
- `lg`
- `icon`
- `icon-xs`
- `icon-sm`
- `icon-lg`

Pattern notes:

Buttons include focus rings, active press movement, disabled behavior, SVG sizing, and shadcn data attributes. Use this primitive instead of custom button elements.

---

## Input Primitive

File: `components/ui/input.tsx`

Default classes:

```text
h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 md:text-sm
```

Pattern notes:

Inputs are compact by default. Larger auth inputs override height with `h-11`.

---

## Data Table Primitive

File: `components/ui/data-table.tsx`

Pattern:

- Generic column definition with `header` and `accessor`.
- Simple responsive wrapper: `w-full overflow-x-auto`.
- Compact table: `w-full text-sm`.

Pattern notes:

This primitive is very simple. Feature-specific tables often use `components/ui/table.tsx` directly for richer cells.

---

## Header Notifications

File: `components/layout/header-notifications.tsx`

Used by admins through `AppShell`.

Notification sources from dashboard layout:

- Pending sales
- Below-cost sales
- Pending proformas
- Pending expenses
- Below-cost products
- Due loans
- Overdue loans

Pattern notes:

Notifications are computed server-side in the dashboard layout so the header reflects live operational risk.

---

## PDF Buttons

Files:

- `components/reports/report-print-button.tsx`
- manager components with PDF download handlers

Pattern notes:

PDF actions should show pending state, use server routes, read `Content-Disposition` for filenames when needed, and never generate PDFs client-side.
Loan statement PDFs should render each sale item on its own table row, repeating the transaction details for multi-item loans instead of collapsing items into comma-separated text.
