# 23 — Testing summary (2026-10-03)

What has been tested, how, what it found, and what is still open. Statuses are honest: "script" = automated check against the dev database; "browser (me)" = I looked at it on screen; "you" = confirmed by hands-on testing by the user.

## 1. Automated end-to-end suite — 183 checks, all passing
Saved in `scripts/e2e/` and run with `npm run test:e2e` (needs the dev server on port 10001; refuses to run unless `.env.local` points at the DEV Supabase project). Each file creates throwaway `zz-` accounts and removes them; a final check confirms nothing is left behind.

| File | Checks | What it proves |
|---|---|---|
| `rep-orders.test.mjs` | 22 | Rep creates orders only for their own customers; size grid and totals; bad input refused; customers/others blocked; rep pages scoped |
| `admin-orders.test.mjs` | 27 | Only admin changes stage/tracking/notes; invalid stage refused; every change logged with who; internal notes never reach the customer; rep sees updates |
| `documents.test.mjs` | 33 | Upload link, file type and size rules, forged paths refused, record saved with real size, download for admin/owner/rep only, direct storage access blocked, delete removes record and file |
| `notifications.test.mjs` | 37 | Each event reaches exactly the right people with working links; others not notified; privacy of notification rows; mark-read; rep document requests |
| `customer-requests.test.mjs` | 33 | Customer request goes to the rep first; rep forwards/dismisses; no-rep goes to admin; only at Shipped/Delivered; one open request per type; customer sees only requests THEY made |
| `assignment.test.mjs` | 11 | New rep, old rep and customer told on (re)assignment; same rep sends nothing |
| `welcome.test.mjs` | 7 | One welcome per new rep/customer; none on password reset |
| `notification-pages.test.mjs` | 8 | Each role's notifications page loads; wrong role redirected; paging 30 + 5, newest first |
| `disable-lockout.test.mjs` | 5 | A disabled customer is locked out at once: old token rejected, portal redirects, API 401, refresh refused |

**Real defect found by the suite:** customers could read document requests a rep made (with private notes). Fixed (policy now `requested_by = 'customer'`), patch `dev-patch-customer-request-policy.sql` applied, suite re-run green.

## 2. Hands-on testing by the user — what it found (all fixed)
- Rep created before the welcome feature had an empty bell (timing, not a bug) → one-off message added; assignment of a customer sent no message (gap) → added; customer not told when a rep creates their order (gap) → added.
- PDF showed blank in the Cursor/in-app browser; Word file could not be previewed; Download gave no feedback → in-page viewer (PDF via pdf.js, Word via docx-preview, images), background download with a toast.
- Disabled client got stuck on "Login successful / Redirecting" (login page trusted a stale saved sign-in) → login validates with the server and shows a clear disabled message.
- Order pages had different headings, forms opened at the bottom, no quick edit → one `OrderHeading`, shared `Modal`, edit modal.

## 3. Browser checks by me (limited)
Rep portal layout, New order form with the size grid and order submit, rep/orders/account pages, admin order page (stage change, carrier dropdown, save buttons). Nothing else was looked at on screen by me.

## 4. Static checks
Type check: 0 errors. Lint: 0 errors, 88 warnings (mostly loose `any`). Both were broken/ignored before today.

## 5. Not tested yet / open
- User's manual run of Parts 6–7 of `21-manual-test-plan.md` (every notification on screen, per-item read button, notifications page, customer request button) and Part 11 (consistency).
- Phone-size checks; the live Vercel site (still on old code); production database (none of the new SQL applied there).
- No automated screen tests: layout, wording and colours rely on a person looking.
- Known fake areas not covered by tests: admin Dashboard numbers, Replication Queue, Products, Sales Hiring, Import CSV.

## 6. Lessons
Scripts prove the rules I wrote; they cannot show missing features or what is on screen. Every gap found by hand (welcome, assignment, order-created, viewers) was something no script was written for. Process: confirm the "who sees what, when" list before building; browser-check when possible; always state which kind of testing backs a claim.
