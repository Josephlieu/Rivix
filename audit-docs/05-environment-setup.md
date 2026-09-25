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
| `ADMIN_PIN` | Gates `/admin` | No — server-only | Provided by team |
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
