# UI Rules

These rules describe the current PrimeTrade interface style. The app is an operational tool: prioritize clarity, density, predictable controls, and low visual noise.

---

## Layout

- Public auth pages are full-screen centered split/hero-style layouts.
- Authenticated pages use `AppShell`: sticky top header, left sidebar, and a rounded content panel.
- Main shell width is `max-w-[96rem]`.
- Authenticated content uses compact padding: `p-3 sm:p-4 lg:p-4`.
- Use `space-y-6` or `space-y-4` for vertical page sections.
- Prefer normal document flow. Do not add fixed overlays except dialogs/popovers from existing primitives.

---

## Header

The authenticated header contains:

- Logo image in a white rounded square.
- Eyebrow: `Prime Trade Inventory Management System`.
- Title: `Operations Hub`.
- Admin notification button when available.
- User chip showing name, role, and email.
- Logout button.

Use the existing `AppShell` instead of recreating page chrome.

---

## Sidebar

Use the existing `Sidebar` component.

Active item:

```text
bg-primary text-primary-foreground shadow-sm
```

Inactive item:

```text
text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground
```

Admin-only items must remain hidden for non-admin sessions.

---

## Cards

Default operational card:

```text
rounded-2xl border border-border/80 bg-card p-4 shadow-sm
```

Use cards for sections, metrics, tables, alerts, and grouped forms. Avoid nested card-on-card designs unless the inner block is a repeated sub-record such as a form row or product item.

---

## Tables

Use `components/ui/table.tsx`.

Patterns:

- Header rows use compact labels.
- Empty states should render a table row with `text-muted-foreground`.
- Tables should sit inside cards or scroll containers where needed.
- Keep numeric values formatted with `formatCurrency` or relevant date/number helpers.

---

## Forms

Use existing primitives:

- `Input`
- `Select`
- `Dialog`
- `Button`

Form behavior:

- Validate again on the server with Zod.
- Show human-readable errors in the component.
- Disable submit buttons while requests are pending.
- Reset dialogs after successful mutations.
- Use Kigali date input helpers for date defaults and parsing.

---

## Buttons

Use `Button` variants:

- `default` for primary actions.
- `secondary` for softer actions.
- `outline` for neutral bordered actions.
- `ghost` for low-emphasis icon or inline actions.
- `destructive` for deletion and dangerous actions.
- `link` only for textual links.

Do not hand-roll button classes unless a screen already has a very specific established pattern.

---

## Dialogs

Use `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogFooter`.

Dialogs are used for:

- Create/edit product
- Restock product
- Create/edit sales
- Invoice details
- Delete confirmation and reason capture

Destructive dialogs should require a reason when the API expects one.

---

## Empty And Loading States

- Use skeleton components where they already exist, such as `DashboardSkeleton`.
- Otherwise use compact muted text: `No records found`, `No movement data yet`, etc.
- Avoid raw technical messages.

---

## Sensitive Data

Non-admin users should not see:

- Cost price
- Stock value
- Cost of sales
- Gross profit
- Return cost
- Below-cost sale internals

When building UI, assume fields may be absent from API responses for non-admin sessions.

---

## Do Nots

- Do not add a store switcher.
- Do not add product image UI unless specifically requested.
- Do not fetch database data directly from client components.
- Do not display raw exception strings to users.
- Do not add new raw hex colors; use tokens or update tokens first.
- Do not bypass existing app shell, sidebar, or auth utilities.
