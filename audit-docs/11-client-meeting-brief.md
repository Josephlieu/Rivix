---
title: Client Meeting Brief
---

# RIVIX Audit — Meeting Brief

A short, presentation-ready summary for walking Joseph through the audit live. Full technical detail lives in [10-role-based-summary.md](./10-role-based-summary.md), [06-findings-and-severity.md](./06-findings-and-severity.md), and [07-client-requirements.md](./07-client-requirements.md) — use this as the talking outline, not the full read.

---

## 1. Open with the headline finding (grabs attention, sets the tone)

**A live database is exposing real customer emails and messages to anyone, with no login required.** Not a theoretical risk — confirmed, real, active right now. This alone justifies urgency, independent of everything else.

## 2. The one-sentence summary of the whole audit

*"You have two working sides today — Customer and Admin — and both have real, fixable problems. The third side you described, Sales Rep, doesn't exist at all yet. Nothing here needs to be scrapped and restarted; it needs real repair plus real new construction."*

## 3. Walk through by role (use [10-role-based-summary.md](./10-role-based-summary.md) as backup detail)

- **Admin**: fully reviewed, every page. Things look like they work but often don't — buttons and forms that don't actually save anything. One serious bug: bulk-importing a spreadsheet can silently save the wrong information with no warning at all.
- **Customer**: fully reviewed. Customers can access the portal without logging in, one customer's information isn't properly kept separate from another's, and the garment-recreation feature looks real but never reaches an actual person.
- **Sales Rep**: doesn't exist yet. Confirmed by you as needing to be built from the ground up — this is the single biggest piece of new work.

## 4. The good news (worth saying explicitly — balances the findings)

- The AI feature that analyzes garment photos is genuinely well-built — we found and fixed the exact bug that was blocking it, which lowers that part of the cost significantly
- Several "broken" features are actually well-built underneath; they just need to be properly connected, not rebuilt from zero
- We found a real commission/territory policy already written up in your system, which gives us real rules to design the Sales Rep role around instead of guessing

## 5. Questions we need answered before finalizing numbers

Read directly from the consolidated list — group into three buckets when presenting:

**Business process (how you want things to work):**
- Order management: what's Admin's role vs. the Sales Rep's?
- Should an approved sample automatically become a real order, or stay manual?
- Do you want admin roles to be flat, or a "Super Admin" tier?
- Do you want internal admin↔rep messaging inside the app, or handle that elsewhere?
- Notifications — email too, or just in-app?

**Access we need from you:**
- QuickBooks login/access so we can connect it
- Do you have logins for the tools your marketing site (rivix.ca) is built on? That would help us solve a mystery we found
- Real tech pack example files
- Okay for us to set up a separate practice/test version of the database, so we never risk touching real customer data while building?

**Your current setup (affects migration scope):**
- What are you using today for customers/orders — Excel, QuickBooks, something else?
- Do you want historical data imported at launch, or a clean start?
- Target go-live date?

## 6. What we haven't finished yet

- The logout bug you reported — need more detail (what exactly happens) before we can pin it down
- A closer look at some outdated software components flagged as possible security risks
- Your marketing site (rivix.ca) — set aside for now per your direction, not part of this project unless you want it included

## 7. Recommended next step

Confirm priority order (which side to build/fix first), answer the business-process questions above, then we lock in final hours/timeline and start.

---

## Appendix: numbers to have ready (support material only, don't lead with these)
- Admin: several things to fix, several new features to build
- Customer: fewer fixes needed, a handful of new features to build
- Sales Rep: the entire thing is new — nothing exists yet
- The live data-exposure issue is the single most urgent item
