---
title: Admin Portal — Page by Page
---

# Admin Portal (`/admin/**`) — What Each Page Means

Gated by a single shared PIN via `middleware.ts` (see [01-roles-and-auth.md](./01-roles-and-auth.md)). No per-page auth checks of their own — protection is entirely at the middleware layer.

## `/admin` — Client Directory
Manage client portal access and compliance profiles: search clients, see contact info, active batch counts, verification status (Verified / Pending Audit), "Add New Client."

## `/admin/clients`
Same directory, likely the canonical route (`/admin` may render this).

## `/admin/orders`
Admin-side order management — presumably create/edit/view orders across all clients (mirrors the customer order view, but for staff).

## `/admin/products`
Admin-side product catalog management.

## `/admin/import`
CSV bulk-import tool — matches `public/rivix_import_template.csv`. Lets admin bulk-load records (likely orders or clients) via spreadsheet upload.

## `/admin/replication`
Admin side of the Uniform Replication feature — review/manage replication requests submitted by customers, respond in the chat thread, update status through the pipeline.

## `/admin/team`
**Not a team-account-creation page.** Read directly from `src/app/admin/team/page.tsx`: this is a form to edit **one single global "Primary Account Representative"** — a hardcoded name/title/email/phone/photo shown identically to every client in the "Your Account Manager" widget. The page's own UI includes a warning: *"Updating this info will change the contact details for everyone currently using the portal."*

There is **no UI anywhere to create individual team member/sales rep accounts, and no way to assign a specific rep to a specific client.** Confirms the gap described in [01-roles-and-auth.md](./01-roles-and-auth.md) and [07-client-requirements.md](./07-client-requirements.md) — even the one editable "rep" field doesn't actually save: the code's `handleSave` has a comment: *"In a real app, this would update a database or global state"* — it's a non-functional mockup, the form doesn't persist anything.

**Confirmed 2026-09-22 — doubly disconnected**: this form's default values (`repInfo` state: "Sarah Chen," `sarah.chen@rivix.ca`) don't even match the actual "Your RIVIX Rep" widget shown live to real users (`RepWidget.tsx` hardcodes a completely separate "Sayem R." / `sayem@rivix.ca`). These two files were never wired together — so even setting aside the broken save button, editing this form was never going to change what customers or admin actually see, because it edits a value nothing else reads from.

## `/admin/hiring` — Sales Hiring & Credibility Board
An internal recruiting dashboard, unrelated to app permissions: "Sol's advising dashboard designed to help the young founders screen applications, evaluate competitor sales reps, and structure high-performance B2B commission SOPs." Screens **job candidates being recruited to work at RIVIX** (e.g. for sales rep positions) — not portal users, and unrelated to the "Team role" gap described elsewhere in these docs.

**Data source — confirmed not from the public website:**
- No careers/apply page exists anywhere on rivix.ca or in this codebase (checked: no route, no public form).
- Candidates only enter via a manual **"Upload Resumes"** button inside `/admin/hiring` — admin staff upload resume files themselves.
- Fields like "Indeed Partner Email" and "Indeed ID/Sync Status" (seen live in the admin UI) strongly suggest candidates are sourced from **Indeed** and manually imported, not submitted directly through the RIVIX site.
- Features: resume viewer, AI-scored scorecard (weighted composite, tiered), Cal.com scheduling integration, correspondence/email tool.

**Note:** relies on a `hiring_candidates` table that does not exist in Supabase — see [04-database-supabase.md](./04-database-supabase.md). Falls back to local browser storage silently.

## `/admin-verify`
The PIN entry screen itself — not a dashboard page, the gate in front of everything above.

## Live Support Center (seen in production, not in this local codebase)
The live admin dashboard shows a "Live Support Center" panel — "Active chat queries from clients portals." This is backed by a real Supabase table (`rep_client_chats`) that **is not referenced anywhere in this local git checkout**. See [04-database-supabase.md](./04-database-supabase.md) — this is a blocker: we may not have the actual deployed source for this feature.
