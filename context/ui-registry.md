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
| Background | Full-screen radial gradient using blue/red/amber utility overlays, plus a photo layer: `next/image` `/images/auth-background.webp` with `fill`, `priority`, `quality={55}`, `sizes="100vw"`, `object-cover opacity-52`, softened by a near-white horizontal gradient and a light primary/accent `color-mix` gradient |
| Layout | `grid min-h-screen max-w-6xl ... lg:grid-cols-[1.05fr_0.95fr]` |
| Login card | `rounded-xl border border-border/80 bg-card p-5 shadow-xl sm:p-7` |
| Feature cards | `rounded-lg border border-border/80 bg-white/70 p-4 text-sm font-medium shadow-sm` |
| Inputs | `Input` with icon absolute left and `h-11` |
| Primary submit | `Button className="h-11 w-full"` |

Pattern notes:

Public login uses more visual branding than operational screens. Keep setup link visible from this page.

The setup-admin page (`app/setup-admin/page.tsx`) uses the same background stack: gradient base, blur blobs, and the `/images/auth-background.webp` photo layer with the same overlays. The photo layer sits in an `aria-hidden` `pointer-events-none absolute inset-0 z-0` wrapper, and `main` gets `relative z-10` to stay above it.

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
| Exports | Admin-only `Catalog PDF` (`FileText`) and `Products Excel` (`FileSpreadsheet`) outline buttons in the page header; products Excel has no date range |

Pattern notes:

Product manager handles active and deleted product lists, create/edit, restock, pagination, and warnings when admin sees price below cost.

Admin rows also have a `Website` outline button (`Globe`) that opens the Product Website Dialog, and every row shows its website status under the name: `On website` (the default) as `rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary`, or `Hidden from website` as `rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground`. Badges are `shrink-0 whitespace-nowrap`.

Long product names wrap instead of widening the table: the name cell overrides the table's `whitespace-nowrap` with `whitespace-normal`, and its content is a `flex min-w-32 max-w-56 flex-col items-start gap-1` stack (name with `wrap-break-word`, badge below). The deleted-products table caps names at `max-w-72`. Row actions are one non-wrapping `flex justify-end gap-1.5` line so rows keep the same height; the "Low Stock Threshold" header wraps (`w-24 whitespace-normal leading-tight`) to save width. If the table is still wider than the screen, it scrolls sideways inside its container.

---

## Website Categories Dialog

File: `components/products/website-categories-dialog.tsx`

Opened by the admin-only outline `Website categories` button (`Tags`) in the products page header. Mounted only while open.

| Property | Pattern |
| --- | --- |
| Size | `DialogContent` with `max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-2xl` |
| Category row | `rounded-xl border border-border/80 p-2.5`: name (`text-sm font-medium`), product-count chip (`rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground`), description (`text-xs text-muted-foreground`) |
| Row actions | `ghost` `icon-sm` buttons: move up, move down, edit (`Pencil`), delete (`Trash2` in `text-destructive`) |
| Inline edit | The row turns into Name and Description `Input`s with `sm` Cancel / Save buttons |
| Add form | `rounded-xl border border-border/80 bg-muted/40 p-3` section; `sm:grid-cols-[1fr_1.4fr_auto]` with Name, Description and a default `Add` button (`Plus`) |
| Save model | Every change saves immediately, then the list reloads; all controls disable while a request runs |
| Errors | Compact `text-sm text-destructive` line above the footer |
| Footer | Single outline `Close` button |

Pattern notes:

Delete asks with `window.confirm` and says how many products will lose the category. Delete is disabled on the last remaining category.

---

## Product Website Dialog

File: `components/products/product-website-dialog.tsx`

| Property | Pattern |
| --- | --- |
| State owner | Client dialog, remounted per product via `key`; loads from `GET /api/products/[id]/website` on open |
| Size | `DialogContent` with `max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-2xl` |
| Show on website switch | Native checkbox (`accent-primary`) inside a `rounded-xl border border-border/80 bg-muted/40 p-3` label; checked by default, unchecking hides the product |
| Fields | `Input` for brand/spec rows/image descriptions; native `select` and `textarea` sharing the input token classes |
| Images | List rows with a `size-16` thumbnail, description input, and `ghost` `icon-sm` buttons for move up, move down, remove |
| Upload | Outline `Upload images` button (`ImagePlus`); files are resized in the browser to 1600px WebP, then sent to R2 with a signed URL |
| Save model | Image add/remove saves immediately; everything else saves with `Save changes` |
| Errors | Compact `text-sm text-destructive` line above the footer |

Pattern notes:

Uploads are disabled with a muted notice when R2 is not configured. The website category is optional; a product without one appears only under "All" on the website. The dialog never shows or edits price, cost or stock.

---

## Sales Manager

File: `components/sales/sales-manager.tsx`

| Property | Pattern |
| --- | --- |
| State owner | Client component with sale draft rows, dialogs, approval state, PDF state, search, pagination |
| Pagination | 20 sales per page |
| Product selection | `ProductSearchSelect` |
| Date defaults | Month-to-today export range from Kigali date helpers |
| Exports | Admin-only From/To date inputs shared by `Sales List PDF` and `Sales List Excel` outline buttons; one `downloadingFormat` state disables both while either is preparing |
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

## PDF And Excel Buttons

Files:

- `components/reports/report-print-button.tsx`
- manager components with PDF/Excel download handlers

Pattern notes:

PDF and Excel actions should show pending state (`Preparing PDF...` / `Preparing Excel...`), use server routes, read `Content-Disposition` for filenames when needed, and never generate files client-side. Excel buttons use the lucide `FileSpreadsheet` icon; PDF buttons use `FileText`.
Customer-facing PDFs (sales invoices, proformas, return receipts, loan statements) draw the signed company stamp bottom-right (right edge at x=467, inset 80pt from the 547 content margin), just above the thank-you bar, via `lib/pdf/stamp.ts` (`getStampedFooterY`, `getStampedPageFooterY`, `drawStamp`) using the downscaled `public/images/stamp.jpg` (JPEG on white, ~39 KB). Internal PDFs (reports, catalog, sales list) are not stamped.
Loan statement PDFs should render each sale item on its own table row. For multi-item loans, transaction-level details such as number, sale date, payment date, and recorded-by should appear only on the first item row.

---

## Loans Manager

File: `components/outstanding/outstanding-manager.tsx`

| Property | Pattern |
| --- | --- |
| State owner | Client component with active loans, deleted loans, filters, payment dialog, PDF download, and admin restore/delete confirmation |
| Search | Name/phone search with normalized alphanumeric matching |
| Date filters | `Input type="date"` from/to filters against serialized sale date |
| Metrics | `StatsCard` for matching loans and admin-visible remaining loan amount |
| Status badges | Token-based destructive/accent badges for overdue and due-today loans |
| Payments | Admin-only installment dialog using amount, `Select` payment method, payment-made date, and notes inputs |
| Delete/restore | Admin-only `PasswordConfirmDialog`; delete returns stock and restore deducts stock again |
| Tables | Shared `Table` primitives inside operational cards; payment history appears as a secondary row |

Pattern notes:

Loans mirror the finished outstanding workflow from the inventory project while preserving PrimeTrade payment method values: `cash`, `mobile-money`, and `bank`. Non-admin users can view their own approved active loans and download statements, but payment/delete/restore actions are admin-only. Payment records store the date the payment was made, defaulting to today's Kigali date when the dialog opens.
