# Code Standards

Implementation rules for PrimeTrade. Follow these to preserve the current architecture and avoid pattern drift.

---

## Engineering Mindset

- Read the existing route/component/model before editing a related feature.
- Keep changes scoped to the requested workflow.
- Prefer local patterns over new abstractions.
- Preserve the single-store model.
- Preserve admin-only visibility for cost/profit data.
- Make stock-changing writes auditable and recoverable.

---

## Next.js 16

This project uses Next.js 16. Before editing framework-specific code, read the relevant guide in:

```text
node_modules/next/dist/docs/
```

Current conventions:

- App Router only.
- `proxy.ts` is used for request/session handling.
- Route Handlers live under `app/api/**/route.ts`.
- Server pages live under `app/(dashboard)`.
- Client managers use `"use client"` only when they need state, effects, dialogs, or browser APIs.
- Root layout uses `next/font/google`.

---

## TypeScript

- Strict mode is enabled.
- Prefer explicit domain types near the component/route that owns them.
- Avoid `any`; use concrete types or `unknown` and narrow.
- Use `const` unless reassignment is necessary.
- Preserve existing named export style.
- Do not introduce barrel exports outside existing local patterns.

---

## API Route Handlers

Standard shape:

```typescript
export async function POST(request: NextRequest) {
  try {
    const { authorized, session } = await requireAuth(request);
    if (!authorized || !session) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const payload = Schema.parse(await request.json());
    await connectToDatabase();

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Human readable message" },
      { status: 500 },
    );
  }
}
```

Rules:

- Use `requireAuth()` for authenticated APIs.
- Use `requireAdmin()` for admin-only APIs.
- Validate request bodies with Zod.
- Connect to MongoDB before Mongoose reads/writes.
- Return a consistent JSON envelope.
- Never expose raw exception strings to users.
- Handle `ZodError` separately when helpful.
- Use `409` for duplicate/constraint conflicts where existing routes do.
- Use `404` when referenced records are missing.

---

## Auth

- Passwords must be hashed with `hashPassword`.
- Password comparisons must use `comparePassword`.
- JWTs must be created with `createToken`.
- Cookies must use `getAuthCookieOptions`.
- Server pages should call `requireServerSession()`.
- API routes should call `requireAuth()` or `requireAdmin()`.
- Session validity must include active user lookup through `getCurrentSession()`.

Never trust only a decoded JWT for authorization-sensitive behavior.

---

## Mongoose And Data Access

- Normal product queries must include `activeRecordFilter`.
- Normal sale queries must use `approvedSaleFilter`, `approvedSaleDateFilter`, or another intentional approval-aware filter.
- Normal invoice queries must exclude soft-deleted invoices.
- Use `.lean<T>()` for read-only data passed to serialization or UI.
- Use domain serializers before sending data to the client when sensitive fields may be present.
- Use aggregation for dashboard/report totals.

---

## Stock And Money Rules

- Product quantity changes must keep low-stock alerts in sync.
- Admin-created sales decrement stock immediately.
- Non-admin sales are pending and should not decrement stock until approval.
- Roll back product decrements if sale creation fails.
- Soft-delete partially created records if later steps fail and physical deletion would lose audit context.
- Use product `costPrice` as `basePrice` on sale/return items when available.
- Revenue calculations must subtract returns where the route already does so.
- Profit calculations must account for cost of sales, expenses, and return cost.

---

## Date And Time

- Use `lib/utils/time.ts` helpers for Kigali-specific formatting and parsing.
- Do not hand-roll local date parsing for business records.
- Dashboard daily ranges use Kigali day boundaries.
- PDF default date ranges should match existing manager helpers.

---

## UI Components

- Use existing primitives from `components/ui`.
- Use `AppShell` for authenticated route chrome.
- Use manager components for interactive screens.
- Keep client state inside client managers.
- Server pages should fetch initial data and pass it down.
- Use `router.refresh()` after mutations when server-rendered data must update.

---

## Error Handling

- User-facing errors must be short and human readable.
- Console errors should include contextual prefixes where practical.
- Do not swallow failures that affect stock or money.
- For secondary operations such as alert sync, log failures without crashing only when the main transaction is already complete and current code does so.

---

## PDF Generation

- PDF generation belongs in `lib/pdf` and API routes.
- Do not generate operational PDFs in client components.
- PDF routes must authenticate.
- Return `application/pdf` and a useful `Content-Disposition` filename.

---

## Environment Variables

Required:

```text
MONGODB_URI
JWT_SECRET
APP_URL
RESEND_API_KEY
PASSWORD_RESET_EMAIL_FROM
```

Rules:

- Never hardcode secrets.
- Do not add `NEXT_PUBLIC_` to secrets.
- Keep server-only credentials server-side.

---

## Dependencies

Current key dependencies:

- `next`
- `react`
- `mongoose`
- `jsonwebtoken`
- `bcrypt`
- `zod`
- `pdfkit`
- `lucide-react`
- `radix-ui`
- `class-variance-authority`
- `tailwindcss`
- `shadcn`

Do not install a new dependency before checking whether an existing primitive or helper already solves the problem.
