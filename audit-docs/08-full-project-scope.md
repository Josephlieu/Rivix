---
title: Full Project Scope & Estimate
---

# RIVIX — Full Project Scope & Estimate

> **DRAFT — not yet sent to client.** Admin-side review is still in progress (Dashboard, Client Directory, Replication, Orders reviewed; Products, Import CSV, Sales Hiring still to go). Numbers below will be revised once that's complete — do not share externally until finalized.

Prepared in response to Joseph's request for a complete scope covering Customer, Admin, and Sales/Team Rep sides: what needs fixing, what needs building, estimated hours, timeline, and dependencies. Every item below traces back to a specific finding or requirement in [06-findings-and-severity.md](./06-findings-and-severity.md) or [07-client-requirements.md](./07-client-requirements.md) so it can be cross-checked.

---

## 1. What needs to be fixed

Issues in the existing code — bugs, security gaps, and non-functional pieces. Grouped by severity.

### Critical / High
- No login check anywhere on the customer portal — pages load for anyone (Finding #2)
- No tenant/customer data scoping — pages filter by a hardcoded name instead of the logged-in user; currently dormant only because the real tables don't exist yet, but the flaw is real (Finding #3)
- A live database table (`rep_client_chats`) is publicly readable with no login required, exposing real client emails/messages (Finding #3c)
- **Admin's shared 6-digit PIN is being removed entirely**, replaced with real ID/password login (same system as customers) — not patched, replaced (Finding #4, decision confirmed 2026-09-22)

### Medium
- Admin dashboard stats, chart, and activity feed are fake or dead; "View All" button does nothing (Finding #7j)
- Client Directory shows hardcoded demo data, not real clients; search/add/menu buttons don't work (Finding #7k) — **confirmed by Joseph as test/seed data**
- Order Management: "Manual Order Entry" and search do nothing; "Generate Certs" is a fake spinner with no real effect (Finding #8d)
- Admin "Sign Out" doesn't clear the session — still logged in for up to 7 days after "logging out" (Finding #7c)
- "Your RIVIX Rep" widget incorrectly shows on the admin side too; admin has no profile page (Findings #7l, #7m)
- No admin-driven account creation for customers or staff — only self-signup works (Finding #7n)
- "New Replication Request" displays a stale, unrelated ticket due to a self-resetting bug (Finding #7g)
- Replication chat is fully simulated — scripted auto-reply, no real person (Finding #7h)
- Two AI-powered API routes can be triggered by anyone with no login, risking cost abuse (Finding #5)
- 19 dependency vulnerabilities flagged (1 critical, 14 high) — needs triage (Finding #9)
- No self-service customer profile/password page (Finding #3b)
- **AI Garment Analysis was failing** — root cause found and it's a one-line fix (deprecated Gemini model name), not a deep issue (see §2 below, this is genuinely good news)

### Low (polish/UX)
- No loading state during login check (page flashes) (#7b)
- No password show/hide toggle (#7d)
- Unbranded confirmation emails (#7e)
- Generic, unbranded 404 page (#7f)
- Chat doesn't auto-scroll to new messages (#7i)
- Missing `hiring_candidates` table, silent local-storage fallback (#8)

---

## 2. What needs to be built from scratch

Confirmed by Joseph as real, needed work — this is genuinely new functionality, not repair.

### Cross-cutting
- **The full 3-role system** — Admin, Team/Sales Rep (individual logins, ~10 people), Customer — replacing today's 2-tier system (Requirement #1, confirmed locked scope)
- Personalized dashboard greetings — company name for customers, first name for reps (Requirement #2)
- Rep-attributed signup flow — unique invite link/token per rep, with a confirmation screen or a mandatory fallback question if no valid link is present (Requirement #8b)

### Customer side
- Certificate request/upload workflow — request button on orders, notification to the assigned rep, admin/rep fulfillment queue, month-then-order grouped display (Requirement #3)
- QuickBooks integration — **read-only** order/invoice history pulled into the portal, explicitly not a payment feature (Requirement #4)
- AI tech pack generation — **substantially reduced scope from original estimate**: the AI engine, prompt, and UI already exist and work (once the model-name bug is fixed); remaining work is reference-image-guided input using Joseph's real example files, plus the review/delivery workflow (Requirement #5)
- Uniform Replication rework — real persistence, real chat tied to the assigned rep, working multi-carrier shipping dropdown (Requirement #6)
- Replication → Order handoff (automatic vs. manual pending Joseph's answer) (Requirement #6b)

### Admin side
- Client Directory redesign — Assigned Rep column/picker, working search/menu, status toggle, new Client Detail page (Requirement #8c)
- Order Management redesign — real order entry, real cert generation tied to the upload workflow, Assigned Rep visibility (Requirement #8d)
- Admin-driven account creation/invite for both customers and staff (Finding #7n, ties to Requirement #1)

### Sales/Team side — currently 0% built
- The entire Team portal: Overview, My Clients (assigned only), Orders, Certificates, Uniform Replication, Messages — proposed to reuse the same UI as the admin replication view, filtered to that rep's own clients (Requirement §6 addendum)
- Dynamic "Your RIVIX Rep" widget reflecting the real assigned rep, not a hardcoded name (Requirement #8)

---

## 3. Estimated hours

Presented as ranges, not a fixed quote — a few open questions below could shift these.

| Area | Estimate |
|---|---|
| Fixes — critical/high | 20–28h |
| Fixes — medium | 14–18h |
| Fixes — low/polish | 8–12h |
| **Fixes subtotal** | **~42–58h** |
| 3-role system + admin/staff invites | 25–35h |
| Personalized dashboards | 5–8h |
| Certificate workflow | 15–20h |
| QuickBooks integration (read-only) | 20–30h |
| AI tech pack (reduced — core engine exists) | 10–16h |
| Uniform Replication rework | 20–25h |
| Replication → Order handoff | 8–12h |
| Rep-attributed signup + rep widget | 15–20h |
| Client Directory redesign | 15–20h |
| Order Management redesign | 10–15h |
| Team/Sales portal build | 25–35h |
| **Builds subtotal** | **~168–216h** |
| **Grand total** | **~210–274 hours** |

---

## 4. Timeline & target completion date

Matches Joseph's own stated preference to focus on one portal at a time:

- **Phase 0 (immediate)**: fix critical/high security issues — ~1–2 weeks, regardless of build sequencing, since it's live risk
- **Phase 1**: whichever portal Joseph prioritizes first (question pending)
- **Phase 2**: the next portal
- **Phase 3**: Sales/Team portal (net-new)

At a typical freelance pace of 20–25 hours/week, the full ~210–274 hour scope is roughly **9–14 weeks**. We're not committing to a fixed calendar date here — it depends on confirmed weekly hours and which portal comes first. Once those are settled, we'll give a specific target date.

---

## 5. Dependencies / access needed from you

- **QuickBooks API credentials** — needed specifically for the QuickBooks integration item; nothing else is blocked by this
- **Real tech pack reference files** — a few example files would let us tune the AI generation to match your actual format
- **Confirmation on a few open business questions** (sent separately) — order management role split, Replication→Order handoff (auto vs. manual), the "no prior rep" signup edge case, dev/staging Supabase setup, the orphaned live chat table, and portal priority order
- **`GEMINI_API_KEY` / `RESEND_API_KEY`** — resolved, we're using our own free test keys; production keys only needed later, before go-live

---

## Note on methodology
This estimate is grounded in direct testing, not just reading code — we set up a local copy of the app, seeded realistic test data, and actually ran features (including the AI analysis engine) to confirm what's real versus what's fake. Several findings were revised during this process as we learned more (e.g., the tech pack feature turned out to be much closer to working than initially assumed) — we'd rather correct our own estimate than overstate scope.
