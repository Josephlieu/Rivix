---
title: Database (Supabase) — What Actually Exists
---

# Database (Supabase) — What Actually Exists vs. What the Code Expects

Project: `unccpzsmhatsjaoowtxs.supabase.co`. Checked live via direct REST queries using the public anon key (the same one the app itself uses client-side).

## Tables the code expects but that DO NOT exist

| Table | Used by | Result |
|---|---|---|
| `orders` | `storage.ts` (customer orders, dashboard, order history, certificates) | `404 PGRST205` — table not found |
| `hiring_candidates` | `hiringStorage.ts` (`/admin/hiring`) | `404 PGRST205` — table not found |
| `products`, `certificates`, `clients`, `users`, `profiles` | (guessed based on features seen) | All `404 PGRST205` |

**Consequence:** every one of these features silently falls back to either hardcoded demo data or browser local storage. The failures are logged to console (`console.error`) but never surfaced to the user or an error tracker — so this could easily go unnoticed in production.

## Tables that DO exist and work

| Table | Columns (from live query) | Notes |
|---|---|---|
| `rep_client_chats` | `id, client_email, sender, sender_name, message, timestamp` | **Readable by anyone, anonymously** — no RLS restriction found. Real data confirmed (2 rows). **Not referenced anywhere in this local codebase** — likely backs the "Live Support Center" feature seen in the live admin dashboard. |

## Critical open question: is this the real deployed source?

Since `rep_client_chats` is used in production (visible in the admin dashboard) but appears nowhere in this git checkout, we may not have the actual deployed source for at least part of the app. This needs to be resolved with the team before the audit can be considered complete — see [06-findings-and-severity.md](./06-findings-and-severity.md).

## Row Level Security (RLS) — not yet verified
We have not yet inspected RLS policies directly (requires the `service_role` key, which bypasses RLS, or the Supabase dashboard's policy editor). This matters because:
- The app's own code provides **zero** tenant scoping (see [06-findings-and-severity.md](./06-findings-and-severity.md)) — if/when tables like `orders` are created, RLS is the only thing that could prevent cross-customer data exposure.
- `rep_client_chats` proves that at least one real table currently has **no effective RLS** protecting anonymous reads.

**Recommended next step:** review RLS policies on every table directly in the Supabase dashboard (Authentication → Policies) before any of the missing tables (`orders`, `hiring_candidates`, etc.) are created or populated with real data.
