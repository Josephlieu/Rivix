# 22 — Code quality review (2026-10-03)

Done by measuring the code (file sizes, who imports what, repeated patterns), not by reading every file. Nothing has been changed yet; this is the plan.

## What the numbers say
- **15,178 lines** of source in `src/`.
- **Three very large files, all in the old, not-yet-rebuilt areas:**
  | File | Lines | Status |
  |---|---|---|
  | `src/app/admin/replication/page.tsx` | 2,040 | Fake / local-storage data; to be rebuilt as the rep+admin Replication tool (M4) |
  | `src/app/admin/hiring/page.tsx` | 1,442 | Real feature with known gaps (missing table, silent local fallback); to be fixed in M3 |
  | `src/app/portal/replication/page.tsx` | 1,044 | **Dead code**: customers are redirected away from `/portal/replication` (decision 2026-09-25) and nothing links to it |
- **Everything built recently is a sensible size** (nothing above ~370 lines). The biggest are `admin/clients` (369), `admin/team` (368) and `admin/orders/[id]` (323).
- **Likely unused library files** (nothing imports them; verify before deleting): `CertificatePDF.tsx` (302 lines, replaced by real documents), `TechPackPDF.tsx` (535), `garmentAiAnalysis.ts` (110), `captureFlatSketch.ts` (36).
- **Repeated UI code:** 30 files build their own `bg-white rounded-3xl` card; 10 repeat the same table header cell style; 6 define their own form input style; most pages repeat the same "fetch → set error → show red box" code.
- **`any` types:** about 66 uses; 4 `eslint-disable`/`ts-ignore`.
- **Automated tests in the repo: 0.** My test scripts have lived in a temporary folder, not in the project.
- **Lint:** `npx eslint src` failed to run ("no files matching") — the lint setup needs checking; lint has not been giving us any signal.
- **Known pre-existing type errors:** 3 in `admin/hiring/page.tsx` (`bio` field).

## Recommendation: what to split now and what to leave
- **Do not split the 2,000-line Replication page or the 1,044-line customer one now.** They are being replaced (M4). Splitting code that will be thrown away wastes the hours. Delete the dead customer page once confirmed (or keep it only as reference for the rebuild).
- **Split Hiring when it is fixed (M3)**, as part of that work: logic out into hooks, the UI into section components.
- **Split and share what we built, now,** because it is live code we will keep touching.

## Plan (hours are my rough estimates)
**A. Quick wins, no behaviour change (≈ 4–5h)**
1. Move the test scripts into the project (`scripts/e2e/…`) with a shared helper and one `npm run test:e2e`, so the tests are kept, versioned and re-runnable.
2. Delete confirmed-dead files (`CertificatePDF`, the dead customer replication page, other unused libs after checking).
3. Make lint run and fix what it finds; fix the 3 hiring type errors.

**B. Shared UI kit (≈ 5–7h)** — small components, then use them in place of the copies:
`PageHeader` (title + subtitle + action), `Card`, table pieces (`Th`, empty-row, loading-row), `FormField` / input styles, `Notice` / `ErrorBanner`, `EmptyState`, `Spinner`. Apply to the pages built this month (clients, team, orders, rep pages, customer pages, notifications). Already shared: `ConfirmModal`, `OrderStatusBadge`, `OrderHeading`, `DocumentList`, `SizeGrid`, `SizeBreakdown`, `CredentialsCard`, `ComboInput`, `NotificationBell`, `NotificationsPage`, `ChangePasswordCard`.

**C. Split mid-size pages into section components (≈ 4–6h)**
- `admin/orders/[id]` → Header, StageCard, ShippingCard, NoteForm, Timeline, DocumentsSection.
- `admin/clients`, `admin/team` → list table, add/edit form modal, row actions.
- `admin/clients/[id]`, `rep/orders/[id]`, `portal/orders/[batch]` → sections.

**D. Shared logic (≈ 3–4h)**
- One `apiFetch` helper (JSON, error message, status) and a small `useAsync` pattern instead of repeating fetch/try/catch/set-state.
- One string-clean helper (copied in several API routes) and one place for shared types (e.g. order/customer types are redefined in several files).
- Remove the remaining `any` in the code we wrote.

**Total for A–D: ≈ 16–22h.** Splitting Hiring (+3–4h) and rebuilding/splitting Replication are already inside M3 and M4; add ≈ 6–8h of splitting work to those two milestones.

## Rules to keep it clean afterwards
- A page file over ~300 lines gets split into section components; logic goes into hooks/lib.
- New repeated UI goes into the shared kit, not copied.
- Every new feature ships with its test script in `scripts/e2e`.

## Progress (2026-10-03)
Done:
- **Tests are now in the project:** `scripts/e2e/*.test.mjs` (10 files, ~177 checks) with `npm run test:e2e` (needs the dev server running; refuses to run unless `.env.local` points at the dev Supabase project). The first full run found a real privacy gap (below).
- **Lint works again:** the project is on Next 16, which removed `next lint`; replaced with ESLint 9 + `eslint-config-next` 16 and a flat config (`eslint.config.mjs`). Result: **0 errors**, 88 warnings (mostly loose `any`). Fixed the real errors: a component created inside a component in the Sidebar (reset its state every render), a `require()` import and two `let`→`const` in old files. The "load data when the page opens" pattern is a warning, to be replaced by a shared data hook (plan D).
- **Type check is clean:** 0 errors (the 3 old Hiring errors were a real bug — the AI resume summary was saved in a `bio` field that nothing reads; it now goes to `background`).
- **Dead code hidden, NOT deleted (rule from the user: never delete code, comment out / hide it):** the old customer Replication page (1,044 lines, unreachable) now lives in `src/app/portal/_replication-disabled/` (a folder starting with `_` is not a web page in Next.js; rename it back to `replication` to restore), and `CertificatePDF.tsx` has an "UNUSED" note at the top. Both are left out of lint. Kept as normal files: `TechPackPDF`, `captureFlatSketch`, `garmentAiAnalysis` (future tech-file feature) and the legacy Hiring/Replication pages (to be rebuilt; ignored by lint for now).
- **One date style everywhere** (`src/lib/format.ts`: "Oct 3, 2026"), and one name for the documents area ("Documents"); order pages share one heading; the shared `Modal` is used by Add Rep, Edit client and Add Client.
Still to do from the plan: the shared UI kit (PageHeader, Card, table pieces, FormField, Notice, EmptyState), splitting the mid-size pages into sections, one fetch helper and shared types, and cleaning the loose `any` types.
