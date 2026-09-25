---
title: RIVIX Project Overview
---

# RIVIX — Project Overview

**RIVIX** is a Vancouver-based industrial workwear/uniform manufacturing supplier. The system audited has two parts:

## 1. Marketing site — [rivix.ca](https://rivix.ca)
Public lead-gen site: workwear programs, industries served, process, certifications (ISO 9001:2015), contact form.

**Confirmed 2026-09-22: this is built on Webflow, not this codebase.** Every page checked (homepage, `/careers`, `/contact`) carries Webflow's `data-wf-site` markers and loads Webflow's own scripts — this is a completely separate platform, hosting, and account from the Next.js/Supabase app below. We have no access to it and it is **out of scope for this audit/project for now**, per the client's direction (2026-09-22: "let's focus on portal only"). Forms on these pages (careers "Apply now," contact) submit to Webflow's own system, not Supabase — unrelated to the `admin/hiring` candidate data found in this codebase. This also plausibly explains the orphaned `rep_client_chats` table (see 04-database-supabase.md) — likely fed by a GoHighLevel/LeadConnector integration tied to the Webflow site, not by anything in this repo.

## 2. Compliance Portal — [portal.rivix.ca](https://portal.rivix.ca)
A Next.js 16 app (`rivix-compliance-portal`, Turbopack), backed by Supabase (Postgres + Auth). Two sides:
- **Customer-facing** (`/portal/**`) — see [02-customer-portal.md](./02-customer-portal.md)
- **Admin-facing** (`/admin/**`) — see [03-admin-portal.md](./03-admin-portal.md)

## Codebase structure
```
src/app/            → Next.js App Router pages
  admin/            → admin dashboard (PIN-gated)
  admin-verify/      → PIN entry screen
  api/               → API routes (admin, hiring, AI analysis)
  login/, signup/    → customer auth
  portal/            → customer-facing app
src/components/      → shared UI (Sidebar, RepWidget, NotificationBell, etc.)
src/lib/             → Supabase client + data access (storage.ts, hiringStorage.ts, replicationStorage.ts)
middleware.ts        → the only route protection in the app (guards /admin only)
```

## Known documentation gaps
- No real README beyond `create-next-app` boilerplate.
- `AGENTS.md`/`CLAUDE.md` contain a suspicious planted instruction — see [06-findings-and-severity.md](./06-findings-and-severity.md#10-suspicious-injected-instruction).
- Local git checkout may be missing at least one live production feature (see [04-database-supabase.md](./04-database-supabase.md)).

## Docs index
- [01-roles-and-auth.md](./01-roles-and-auth.md) — who can access what, and how
- [02-customer-portal.md](./02-customer-portal.md) — meaning of each customer-facing page
- [03-admin-portal.md](./03-admin-portal.md) — meaning of each admin-facing page
- [04-database-supabase.md](./04-database-supabase.md) — what's actually in the database vs. what the code expects
- [05-environment-setup.md](./05-environment-setup.md) — env vars, local dev setup
- [06-findings-and-severity.md](./06-findings-and-severity.md) — full audit findings report, with proof
- [07-client-requirements.md](./07-client-requirements.md) — transcribed client requirements from kickoff call
- [sessions/](./sessions/) — dated session logs, one file per work session (chronological record of what was done/found each day)
- [diagrams/](./diagrams/) — flow and relationship diagrams for each role (SVG), referenced from [07-client-requirements.md](./07-client-requirements.md)
