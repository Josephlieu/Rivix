---
title: Roles & Authentication
---

# Roles & Authentication

## Actual role model: 2 tiers, not 3

**Expected (per team discussion):** Customer, Sales Person (assigned to customers), Admin (manages the sales team).

**As built:** only **Admin** and **Customer** exist. There is no Sales Person role anywhere — not in the database, not in the UI, not in any auth check.

| Role | Exists? | Auth mechanism | Identity |
|---|---|---|---|
| Customer | ✅ | Supabase Auth (email/password or Google OAuth), self-serve signup | Per-account (Supabase `auth.users`) |
| Admin | ✅ | Shared 6-digit PIN (`ADMIN_PIN` env var) | None — one shared secret, no per-admin identity |
| Sales Person | ❌ Not built | — | — |

"Sales" only appears as a job-title string for hiring candidates under `/admin/hiring` (an internal recruiting tool for hiring actual sales employees) — unrelated to app permissions.

## Customer auth flow
1. `/signup` — Supabase `auth.signUp({ email, password })`, or Google OAuth. No invite, no domain check, no approval step.
2. Confirmation email sent (`emailRedirectTo` → `/portal`, fixed during audit to use dynamic origin instead of a hardcoded production URL).
3. `/login` — `signInWithPassword`, redirects to `/portal` on success.
4. **No role/permission is ever assigned** — every successful signup becomes a generic "customer."

## Admin auth flow
1. `/admin-verify` — enter the shared PIN.
2. `middleware.ts` checks a cookie (`rivix_admin_pin`) against `process.env.ADMIN_PIN` for any request to `/admin/:path*`.
3. The cookie's value is the plaintext PIN itself — not a token, not tied to any person.

## Sales rep assignment — not built
Per the team's described intent: a customer should be automatically or admin-assigned a sales rep, and be able to discuss with them; or a sales exec should be able to cold-call/email a lead, send them a signup link, and have that customer land connected to the same rep.

**None of this exists.** Checked:
- No `assigned_rep`, `sales_rep_id`, `referral`, or invite-link logic anywhere in the codebase (full grep, zero matches).
- `src/components/RepWidget.tsx` — the "Your RIVIX Rep" card shown on the customer dashboard is **fully hardcoded**: name "Sayem R.", email `sayem@rivix.ca`, phone `(403) 555-1234`. Every single customer sees the exact same card regardless of who they are or who referred them.

## Route protection summary

| Route group | Protected? | How |
|---|---|---|
| `/admin/**` | ✅ | `middleware.ts` matcher `['/admin/:path*']`, PIN cookie check |
| `/portal/**` | ❌ | Nothing — no page or layout checks `getSession()`/`getUser()` |
| `/api/admin/**` | ✅ (mixed — see below) | Some routes check PIN, some don't |

See [06-findings-and-severity.md](./06-findings-and-severity.md) for the full list of auth gaps with proof.
