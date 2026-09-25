---
title: Milestone Timeline — Now to Production
---

# Milestone Timeline — Now to Production-Ready

An illustrative week-by-week plan, assuming roughly 20 hours/week of work. Actual pace depends on confirmed hours/week and which portal Joseph wants prioritized first (shown here as Customer → Admin → Sales Rep, but this order is flexible). All numbers are estimates, not fixed commitments.

---

## Phase 0 — Setup & Critical Fixes
**Weeks 1–2 · ~35 hours**

- Set up a separate practice/staging database, so nothing here ever touches real customer data — **3h**
- Set up a staging (testing) version of the app, separate from the live production site — **3h**
- Fix: add real login protection to the customer portal — **6h**
- Fix: lock down the live database table that's currently exposing customer emails/messages — **4h**
- Build the foundation for real individual admin logins, replacing the shared code — **12h**
- Test all of the above on staging before anything touches production — **5h**

*Environment: everything built and tested on staging only. Nothing goes live yet.*

---

## Phase 1 — Customer Side
**Weeks 3–6 · ~90 hours**

- Remaining smaller fixes (account/password page, password visibility toggle, branded emails, proper error page, chat scrolling, replication display bugs) — **20h**
- Making sure each customer only ever sees their own information — **15h**
- Certificate request-and-upload feature, start to finish — **15h**
- QuickBooks connection for read-only order history — **25h**
- Finishing the AI tech-pack feature (fix + real example files + review step) — **15h**
- Test everything on staging — **5h** (interim staging cert build)

*Environment: staging only, tested with realistic sample data before moving on.*

---

## Phase 2 — Admin Side
**Weeks 7–10 · ~90 hours**

- Remaining fixes (real dashboard numbers, working buttons across Client Directory/Orders, safe CSV import, real notifications, sign-out actually working) — **30h**
- Rebuilding Client Directory and Order Management properly — **30h**
- Fixing and improving the resume-scanning and garment-analysis AI tools — **15h**
- Team & Rep Management rebuilt as a real tool (ties into Phase 3 below) — **15h**

*Environment: staging only.*

---

## Phase 3 — Sales Rep Side (entirely new)
**Weeks 11–15 · ~90 hours**

- Individual rep logins and the customer-to-rep connection system — **25h**
- Full rep dashboard: their clients, orders, certificates, replication requests, messaging — **50h**
- Testing the complete rep experience on staging — **15h**

*Environment: staging only.*

---

## Phase 4 — Full System Testing
**Week 16 · ~20 hours**

- End-to-end test: create a real customer → assign a rep → place an order → track production → issue a certificate → confirm everything shows correctly to the right people and nobody else, all three roles working together
- Fix anything this testing finds
- Repeat for edge cases (no rep assigned, multiple customers per rep, admin overriding a rep's conversation)

*Environment: staging only — this is the last stop before production.*

---

## Phase 5 — Deployment & Go-Live
**Week 17 · ~15 hours**

- Final review and sign-off
- Migrate historical data, if that's what Joseph decides (pending his answer — could add time depending on volume)
- Deploy to the real production site
- Closely monitor for issues in the first few days after launch, fix anything urgent immediately

*Environment: production, for the first time — everything before this point never touched real data.*

---

## Totals
- **~340 hours** across **~17 weeks** (roughly 4 months) at a 20-hour/week pace
- Faster with more hours/week committed, e.g. ~25 weeks → ~14 weeks at 25h/week, or compress further with more hours or more people working in parallel
- This is higher than our earlier rough estimate because it now explicitly includes staging setup, QuickBooks, full AI tech-pack completion, and a dedicated testing phase — all real work that needs its own time, not assumed to happen for free inside the build hours

## Note on order
This plan assumes Customer → Admin → Sales Rep. If Joseph prioritizes differently (e.g., Sales Rep first since it's the biggest gap), the phases simply reorder — the total hours stay roughly the same either way.
