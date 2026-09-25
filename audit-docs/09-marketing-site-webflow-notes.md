---
title: Marketing Site (rivix.ca) — Webflow Notes, Parked
---

# rivix.ca — Webflow Notes (Parked, Separate From Portal Scope)

> **Status: parked.** Client direction (2026-09-22): "let's focus on portal only." This file holds what we found about `rivix.ca` for later reference — not part of the active portal audit/scope, and not yet raised with Joseph. Revisit and ask only if/when he wants it addressed.

## What we found

- `rivix.ca` (homepage, `/careers`, `/contact`, likely all pages) is built on **Webflow**, not this Next.js/Supabase codebase. Confirmed via `data-wf-site`/`data-wf-page` markers matching across pages (site ID `698d15c579b2c64b94638563`).
- A **LeadConnector (GoHighLevel)** chat widget is embedded on these pages — a separate marketing/CRM platform layered on top of the Webflow site.
- We have **no access** to either the Webflow account or the GoHighLevel account.
- This plausibly explains the orphaned `rep_client_chats` Supabase table found during the portal audit (see `06-findings-and-severity.md` finding #3c / `04-database-supabase.md`) — likely fed by a GoHighLevel automation tied to this external site, not by anything in the portal codebase.

## Careers page (`/careers`)
- Real "Apply now" form: Full Name, Email, Phone, LinkedIn URL, Outbound Sales Experience (free text)
- Native Webflow form (`action: https://rivix.ca/careers`, `method: post`, `id: post-form`) — not connected to Supabase or the admin hiring dashboard in any way
- Submissions go into Webflow's own "Forms" panel, and/or an email notification if configured (can't confirm who receives it without Webflow access)

## Contact page (`/contact`)
- Native Webflow form (fields: First-Name, Company, Industry, Email, Anything-else-we-should-know)
- Same situation — goes into Webflow's own system, not connected to anything in the portal

## Open items if this ever gets picked up
1. Confirm with Joseph whether he has Webflow / GoHighLevel account access to share
2. Confirm whether anyone is reliably checking Webflow's Forms panel or the notification email today (real applicants/leads may currently be landing somewhere unmonitored)
3. If he wants integration: Webflow supports form-submission webhooks — a new API route in this app could receive real Careers applications and write them into a real `hiring_candidates` Supabase table, replacing the current manual Indeed-copy-paste process (see `07-client-requirements.md` hiring section for the portal-side hiring tool findings)
4. This is genuinely separate work from the portal build — would need its own scoping/estimate if pursued
