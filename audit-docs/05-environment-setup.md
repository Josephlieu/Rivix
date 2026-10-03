---
title: Environment Setup
---

# Environment Setup

## Required env vars (`.env.local`)

| Variable | Purpose | Public? | Source |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Yes (bundled client-side) | Supabase dashboard or live JS bundle |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key | Yes (bundled client-side) | Supabase dashboard or live JS bundle |
| `SUPABASE_SERVICE_ROLE_KEY` | Full-access key, bypasses RLS | No — server-only | Supabase dashboard → Project Settings → API → Legacy keys |
| `ADMIN_PIN` | **No longer used** (2026-09-29) — admin now uses real individual logins. Safe to delete from `.env.local` and Vercel. | — | — |
| `GEMINI_API_KEY` | Google GenAI (garment/resume analysis) | No | Team's Vercel env, or generate a free test key at aistudio.google.com |
| `RESEND_API_KEY` | Transactional email | No | Team's Vercel env, or generate a free test key at resend.com |
| `HIRING_FROM_EMAIL` | From-address for hiring emails | No (but was recoverable — see finding #6) | Team, or via the unauthenticated leak we found |
| `NEXT_PUBLIC_CALCOM_BOOKING_URL` | Cal.com booking widget | Yes | Has a hardcoded fallback in code, optional |

## What we could get ourselves (no blocker)
- Supabase URL + anon key — extracted directly from the live portal's public JS bundle (by design, since `NEXT_PUBLIC_*` vars are always bundled into client-side code).
- `service_role` key — pulled from the Supabase dashboard's "Legacy anon, service_role keys" tab.
- `HIRING_FROM_EMAIL` — recovered via an unauthenticated GET request to `/api/hiring/send` (a bug in itself, see finding #6).
- `ADMIN_PIN` — provided directly by the team.

## Remaining blocker
`GEMINI_API_KEY` and `RESEND_API_KEY` are not derivable from the live site and were not shared. **Not a hard blocker** — free test keys can be created independently (Google AI Studio, Resend) to fully exercise the code paths. Only blocks verifying the *actual production* key scopes/permissions and Resend's domain-verification (SPF/DKIM) setup for `rivix.ca`.

## Local dev server
```bash
npm install
npm run dev   # runs on port 10001 (see package.json)
```
Runs against whatever `.env.local` points to — **currently the real production Supabase project**, since that's the only instance we have credentials for. See [06-findings-and-severity.md](./06-findings-and-severity.md) for the discussion about needing a separate dev/staging Supabase project before further hands-on testing.

## Known code fix already applied during this audit
`signup/page.tsx` and `login/page.tsx` originally hardcoded all auth redirects to `https://portal.rivix.ca/portal`, which broke local testing entirely (a local signup would always redirect to production). Fixed to use `window.location.origin` dynamically. See finding #7.

## Running costs and plans (added 2026-10-01)

Development and testing run on free plans. A real launch will probably need paid ones. These come from my understanding of the providers' plans — **check current prices and limits before quoting a number to Joseph.**

| Item | Free plan today | Why a paid plan is likely for production | Rough cost (verify) |
|---|---|---|---|
| **Supabase** (database, logins, file storage) | Dev project on free | Free projects can be paused after inactivity (portal offline); paid plans include automatic daily backups, which free plans do not; free plans cap total storage (~1 GB) and per-file size (~50 MB) — the 64 MB Ontario Parks tender would not upload | ~$25/month (Pro) |
| **Vercel** (hosting) | Hobby | The Hobby plan is meant for personal, non-commercial use; a company portal should be on the paid plan | ~$20/month per person |
| **AI calls** (garment/tech-pack analysis, resume scoring, later tender screening, summaries, bid comparison) | pay per use | Running cost, grows with use; whose account pays is an open question | varies |
| **Email** (Resend) | free tier | Likely enough at first volumes; needs the rivix.ca domain connected | free at first |
| **QuickBooks API** | — | I believe Intuit's developer access is free; confirm when we get there | check |

**Files and backups:** documents go in a private Supabase Storage bucket (same pattern as product specs). I'm **not sure** how Supabase backs up stored files compared with the database — confirm before launch and, if needed, keep our own copy.

**Dev and production are separate Supabase projects.** The real production project already exists (from the original developer). Unknown to us: which plan it is on, who pays for it, and whether backups are on. Every new table, bucket and SQL file in `audit-docs/deliverables/` must be applied to production before launch (none has been).

**What to tell Joseph:** a realistic floor is roughly $45+/month for Supabase and Vercel together, plus AI usage, so the first bill is not a surprise.
