# Memory - Product SKU Reservation

Last updated: 2026-06-20 18:17 +02:00

## What was built

- Updated `app/api/products/route.ts` so generated product SKUs are checked against all product records, including soft-deleted products.
- `generateProductSku()` now finds the latest matching SKU prefix without `activeRecordFilter`.
- `generateProductSku()` now checks candidate availability with `Product.exists({ sku })`, so deleted product SKUs remain reserved.
- Updated `context/progress-tracker.md` to document that product SKU generation avoids reusing soft-deleted product SKUs.

## Decisions made

- SKU history is enforced in the generator only for this pass.
- The `Product` model SKU index was not changed; it still uses the existing partial unique index for active products.
- Product name duplicate behavior remains unchanged: active products block duplicate names, soft-deleted products do not.
- No UI pattern changed, so `/imprint` did not update `context/ui-registry.md`.

## Problems solved

- New product creation could previously generate a SKU that had only been used by a soft-deleted product, because SKU lookup and existence checks used `activeRecordFilter`.
- Single and batch product creation are both covered because both paths call the same `generateProductSku()` helper.

## Current state

- `/review` found no issues across plan alignment, system integrity, or production readiness.
- `git diff --check` passed, with only the repo's existing CRLF warning.
- Focused `npx.cmd eslint app/api/products/route.ts` timed out after 30 seconds, consistent with existing project verification notes.
- Current expected working-tree changes are `app/api/products/route.ts`, `context/progress-tracker.md`, and this overwritten `memory.md`.

## Next session starts with

- If continuing this feature, decide whether to strengthen the database invariant by changing the `Product` SKU index from active-only uniqueness to global SKU uniqueness.
- If shipping as-is, run the normal project verification flow when practical: `npm run lint` and `npm run build`, or document the existing timeout/pre-existing-error caveats.

## Open questions

- Whether SKU permanence should also be enforced at the MongoDB index level is still unresolved.
- Existing databases may already contain active/deleted SKU duplicates; that only matters if the project later moves to a global unique SKU index.
