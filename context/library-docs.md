# Library Docs

Project-specific usage patterns for third-party libraries in PrimeTrade.

---

## Next.js

Version: `16.2.4`

Rules:

- Read `node_modules/next/dist/docs/` before editing Next-specific APIs.
- Use App Router conventions.
- Use `proxy.ts` for request session handling.
- Use Route Handlers for APIs.
- Use Server Components by default.
- Add `"use client"` only for state, effects, browser APIs, event handlers, or client-only libraries.

Current examples:

- `app/layout.tsx`: root metadata, Geist fonts, global CSS.
- `app/(dashboard)/layout.tsx`: server layout requiring session and loading notifications.
- `proxy.ts`: cookie/session refresh and invalid-session handling.

---

## React

Version: `19.2.4`

Patterns:

- Server pages fetch initial data and pass props to client managers.
- Client managers own form state, search, pagination, dialogs, loading, and local optimistic state.
- Use `useEffect` for client-side API fetches such as dashboard stats.
- Use `useMemo` for derived filtered/paginated lists and totals.

---

## Tailwind CSS v4

Use token utilities generated from `app/globals.css`.

Rules:

- Use `@theme inline` variables.
- Do not create a Tailwind config for color tokens.
- Prefer semantic classes: `bg-card`, `border-border`, `text-muted-foreground`, `bg-primary`.
- Avoid adding raw hex utility classes. There are existing exceptions in dashboard stats; do not expand them.

---

## shadcn / radix-nova / Radix UI

The project uses shadcn-style primitives in `components/ui`.

Use existing primitives first:

- `Button`
- `Input`
- `Dialog`
- `Select`
- `Table`
- `DataTable`

Button variants come from `class-variance-authority` in `components/ui/button.tsx`.

Rules:

- Do not create parallel primitive systems.
- Keep accessible dialog/select behavior by using the existing wrappers.
- Keep button/icon sizing consistent with the primitive defaults.

---

## Mongoose

Version: `9.6.1`

Connection:

```typescript
import { connectToDatabase } from "@/lib/db/connection";

await connectToDatabase();
```

Patterns:

- Models live in `lib/db/models`.
- `global.mongoose` caches the connection in development.
- Use `.lean<T>()` for read-only records.
- Use schema indexes for uniqueness and performance.
- Use aggregation for dashboard/report totals.

Important filters:

```typescript
import { activeRecordFilter } from "@/lib/db/soft-delete";
import { approvedSaleFilter, approvedSaleDateFilter } from "@/lib/db/sales-approval";
```

Rules:

- Apply active/approved filters intentionally.
- Do not query soft-deleted records by accident.
- Do not expose Mongoose documents directly when serialization is needed.

---

## Zod

Version: `4.4.1`

Validators live in `lib/db/validators`.

Patterns:

```typescript
const payload = CreateSaleSchema.parse(await request.json());
```

Rules:

- Validate every mutating route body.
- Return the first issue message when helpful.
- Keep validation rules close to DB/domain constraints.

---

## JSON Web Token

Library: `jsonwebtoken`

Core file: `lib/auth/session.ts`

Patterns:

- `createToken(session)` signs an `AuthSession`.
- `verifyToken(token)` validates signature and idle timeout.
- `refreshSessionActivity(session)` updates idle timestamp.
- `getAuthCookieOptions(session)` sets cookie attributes and max age.

Rules:

- Do not manually call `jwt.sign` outside auth helpers.
- Do not manually decode a token for authorization decisions.

---

## bcrypt

Core file: `lib/auth/hash.ts`

Use:

- `hashPassword(password)`
- `comparePassword(candidate, hash)`

Rules:

- Never store plaintext passwords.
- Never compare password strings manually.

---

## PDFKit

Library: `pdfkit`

PDF generators live in `lib/pdf`.

Current generators:

- `invoice-generator.ts`
- `products-catalog-generator.ts`
- `report-generator.ts`
- `return-receipt-generator.ts`
- `sales-list-generator.ts`
- `outstanding-generator.ts`

Rules:

- Generate PDFs server-side only.
- API routes should authenticate before generating.
- Keep business formatting in shared utilities where possible.
- Return generated documents through API routes with PDF headers.

---

## lucide-react

Used for UI icons.

Rules:

- Prefer lucide icons over custom SVG for controls.
- Use `size-4`, `size-5`, or established local sizing.
- Icon-only buttons need accessible labels where interactive.

---

## Resend / Email

The package is not listed directly, but password reset email logic lives in:

- `lib/email/password-reset.ts`
- `lib/auth/password-reset.ts`

Environment:

```text
RESEND_API_KEY
PASSWORD_RESET_EMAIL_FROM
APP_URL
```

Rules:

- Never expose reset token hashes.
- Store hashes in `PasswordResetToken`.
- Expired reset tokens are handled by TTL index.

---

## class-variance-authority

Used by `components/ui/button.tsx` to define button variants and sizes.

Rules:

- Add button variants only when a repeated product-wide button style exists.
- Prefer passing `className` for isolated layout tweaks.

---

## tailwind-merge / clsx

Core utility:

```typescript
import { cn } from "@/lib/utils";
```

Rules:

- Use `cn()` for conditional className composition.
- Avoid manual string concatenation for complex class logic.
