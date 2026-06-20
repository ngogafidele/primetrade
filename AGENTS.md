---
description: Instructions building PrimeTrade
globs: *
alwaysApply: true
---

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes - APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

## Read Before Anything Else

Read in this exact order before any implementation:

1. context/project-overview.md
2. context/architecture.md
3. context/ui-tokens.md
4. context/ui-rules.md
5. context/ui-registry.md
6. context/code-standards.md
7. context/library-docs.md
8. context/build-plan.md
9. context/progress-tracker.md

## Rules That Never Change

- PrimeTrade is a single-store inventory and operations app. Do not add store/location scoping unless explicitly requested.
- Never bypass the existing auth helpers. Server pages use `requireServerSession()`; API routes use `requireAuth()` or `requireAdmin()`.
- Never expose admin-sensitive cost/profit fields to non-admin users.
- Normal product reads must use `activeRecordFilter`; normal sales totals must use approval-aware filters.
- Stock-changing writes must preserve stock correctness, sync low-stock alerts, and compensate/rollback when later writes fail.
- Do not add new hardcoded hex values or raw Tailwind color classes. Use the tokens in `app/globals.css`; existing raw color exceptions are documented in `context/ui-tokens.md`.
- Update `progress-tracker.md` and `ui-registry.md` after every completed feature that changes behavior or UI patterns.
- Before using or changing a third-party library integration, read `context/library-docs.md` for project-specific rules.
- If the same problem persists after one corrective prompt, stop and run `/recover`.

## Available Skills

- `/architect` - before any complex feature. Think before building.
- `/imprint` - after any new UI component. Capture patterns.
- `/review` - before demo or when something feels off.
- `/recover` - when something breaks after one failed correction.
- `/remember save` - when a feature spans multiple sessions.
- `/remember restore` - when returning after a multi-session feature.
