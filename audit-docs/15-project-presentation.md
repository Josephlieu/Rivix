---
title: RIVIX Project Presentation
---

# RIVIX Project — Presentation

What we did, what we found, and what's needed to make this a real working system — organized by role, each with its own build plan and timeline.

---

## Part 1 — What we did

We audited both the Customer and Admin sides of your portal in full, page by page — not just reading the code, but actually clicking through, testing real scenarios, seeding real test data, and confirming what genuinely works versus what only looks like it works. We also confirmed there's no Sales Rep side at all today.

Along the way we found one urgent issue (real customer data exposed live, no login needed), fixed one bug ourselves (a broken AI feature), and worked with you directly to clarify how the business should actually operate inside the app — like how Admin and Sales Reps should split responsibility on orders.

---

## Part 2 — What we understood about how the business should work

- **Customer** signs up, places orders (by talking to a rep), tracks their orders and compliance certificates. Uniform Replication/tech packs are **not visible to the customer at all** — corrected 2026-09-25: it's a purely internal Admin↔Sales Rep workflow, to prevent designs leaking to competing manufacturers
- **Sales Rep** sells to customers, creates their orders, owns the relationship and communication, and stays informed throughout — but doesn't chase factories or paperwork
- **Admin** runs everything operational — production, shipping, certificates, supplier communication — for every order across every rep, and only steps into a customer conversation directly for serious issues

This is confirmed directly by you, not something we assumed.

---

## Part 3 — Role by role: issues, what's missing, and the plan

---

# CUSTOMER

## Issues found
- The portal can be viewed without logging in at all
- Customer data isn't kept properly separate — the system doesn't reliably check who's logged in
- A live database is exposing real customer information publicly — the most serious issue found in the whole audit
- No way for a customer to manage their own account or password
- The "your rep" contact shown is fake, identical for every customer
- Uniform replication requests don't save anywhere real, and the built-in chat isn't connected to an actual person
- **Scope correction (2026-09-25)**: Uniform Replication/tech packs should never have been customer-facing at all — corrected again after review: **no customer visibility into any part of it, not even a finished result.** It's being rebuilt as a purely internal Admin↔Sales Rep workflow.
- Smaller issues: can't see your password while typing, unbranded emails, a generic error page
- One reported bug (logging out "glitches" the site) — not yet reproduced, needs more detail from you

## What needs building from scratch
- Certificate request-and-delivery system, with a "Request Certificate" button per order
- Connection to QuickBooks for order/invoice/PO history, plus a "Request Invoice" button
- Product Specs page rebuilt as admin-managed, real per-customer technical files/drawings (not a generic example catalog)
- A simple account/profile page
- Uniform Replication/tech packs removed from the customer side entirely — see Sales Rep

## Customer-side milestones

| Phase | What happens | Standard | With AI-assisted coding |
|---|---|---|---|
| 1. Urgent fixes | Lock down the exposed data, add real login protection | ~1 week | ~1 week (security work — still needs careful review, doesn't speed up) |
| 2. Small fixes | Account page, password visibility, branded emails, error page | ~1 week | ~0.75 week |
| 3. New features | Certificates + request button, QuickBooks + invoice request, product specs rebuild | ~3-4 weeks | ~2.5-3 weeks |

**Customer total: roughly 5-6 weeks → ~4-4.5 weeks with AI-assisted coding**

---

# ADMIN

## Issues found
- Login is a single shared code for everyone — no individual accounts, and "signing out" doesn't fully work
- The dashboard shows fake numbers, not real ones
- The client list is test data (confirmed with you)
- Several pages have buttons that don't actually do anything (Orders, certain actions)
- The "Team & Rep Management" page doesn't manage anyone — it's a placeholder
- The hiring tool stores real people's personal information the wrong way, and its resume-scanning feature is broken (cause identified)
- Bulk-importing spreadsheet data can silently save the wrong information with zero warning — the most serious admin-side bug found
- The notification bell shows fake alerts, not real ones

## What needs building from scratch
- Real individual admin logins
- A real Team & Rep management tool — add reps, assign them to customers
- A proper client management page, including a way to create a client account directly and connect it to a rep
- A working order management system, matching the role split you confirmed
- A safer way to bulk-import spreadsheet data
- A real notifications system
- A simple admin account page

## Admin-side milestones

| Phase | What happens | Standard | With AI-assisted coding |
|---|---|---|---|
| 1. Urgent fixes | Replace the shared login with real individual accounts | ~1 week | ~1 week (security work — still needs careful review) |
| 2. Fix what's broken | Real dashboard, working Client Directory, working Orders, safer CSV import, sign-out actually working | ~3 weeks | ~2-2.5 weeks |
| 3. New builds | Real Team & Rep management, Add New Client flow, real notifications, admin account page | ~1.5-2 weeks | ~1.25-1.5 weeks |

**Admin total: roughly 5-6 weeks → ~4.25-5 weeks with AI-assisted coding**

---

# SALES REP

## Issues found
None — this role doesn't exist anywhere in the app today. Confirmed by you as needing to be built from the ground up.

## What needs building from scratch (all of it)
- Individual logins for each rep
- A real way to connect a specific customer to a specific rep — including the option for a rep to invite someone directly and automatically be connected
- A full dashboard: their customers, order creation (per the role split you confirmed), certificate status, and direct messaging with their own customers
- The Uniform Replication/tech-pack tool itself (confirmed 2026-09-25: Sales Rep/Admin-only, purely internal — never shown to the customer). Any tech pack a rep creates also syncs to Admin for full visibility.
- Support for admin joining a customer conversation when needed, while the rep always stays included — never quietly removed

## Sales Rep milestones

| Phase | What happens | Standard | With AI-assisted coding |
|---|---|---|---|
| 1. Foundation | Individual logins, the customer-to-rep connection system, permissions | ~2 weeks | ~1.5-2 weeks (security-sensitive parts stay careful) |
| 2. Reused pages | Dashboard, My Clients, Orders (with the ability to create one), Replication — built faster by reusing existing Admin page designs | ~1.5 weeks | ~1 week (biggest speedup — heavy reuse) |
| 3. New pages | Certificate request queue, real messaging system, rep invite links | ~1.5-2 weeks | ~1.25-1.5 weeks |

**Sales Rep total: roughly 5-5.5 weeks → ~3.75-4.5 weeks with AI-assisted coding**

---

## Part 4 — After all three roles: final testing and go-live

| Phase | What happens | Standard | With AI-assisted coding |
|---|---|---|---|
| Full system testing | Test all three roles working together with real data, on a safe practice copy of the system — never on real customer data | ~1 week | ~1 week (human verification time — doesn't speed up) |
| Go-live | Final review, move to the real live site, monitor closely for the first few days | ~1 week | ~1 week (mostly manual steps — doesn't speed up) |

---

## Part 5 — Total picture

| | Standard | With AI-assisted coding |
|---|---|---|
| Customer | ~5-6 weeks | ~4-4.5 weeks |
| Admin | ~5-6 weeks | ~4.25-5 weeks |
| Sales Rep | ~5-5.5 weeks | ~3.75-4.5 weeks |
| Testing & go-live | ~2 weeks | ~2 weeks (doesn't compress) |
| **Combined, one at a time** | **~17-19 weeks** (about 4-4.5 months) | **~14-16 weeks** (about 3.5-4 months) |

**Why it doesn't shrink more than this**: AI-assisted coding speeds up *writing* the code — but security-sensitive work still needs the same careful review, and testing/verification time is bound by human time either way. The real risk to this timeline isn't coding speed — it's how quickly we get answers and access from you (see the open questions below). Shorter still possible if phases run partly in parallel, or if we start with only one or two roles first.

## Part 6 — Before we lock in final numbers, we need your input on
- Do you have a budget range in mind for this project?
- How far should we take the commission/territory rules we found — just shown as reference, actively enforced (auto-reassigning inactive accounts), or fully calculating real payouts per rep?
- If we import your historical data, roughly how many customers/orders are we talking about?
- Roughly how many customers/reps/orders do you expect this to handle — just so we design for the right scale?
- Which role should we start with?
