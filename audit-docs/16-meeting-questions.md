---
title: Questions to Ask in the Meeting
---

# Questions to Ask Joseph — Meeting Checklist

Everything still genuinely open, grouped for a live conversation. Already-resolved items (3-role build, order management split, test keys, client data authenticity, Webflow integration, priority order, expected scale, Manual Order Entry, signup edge case, hiring SOP display) are left out — those are settled.

---

## A. Budget (still open — ask first)

- [ ] **Do you have a budget range in mind for this project?**

**Resolved 2026-09-25**: priority order confirmed as **Customer first**. Expected scale confirmed: ~4 orders/customer/year, ~15 sales reps total, each rep bringing on 3-4 new customers/month.

## B. The commission/territory system — how far to take it

- [ ] We found real commission and territory rules already written up. Should the app:
  - Just **display** this as reference, or
  - **Actively apply it** (e.g., auto-reassign an inactive account after 12 months), or
  - **Actually calculate real commission payouts** per rep? (this last option is a much bigger build than the other two)

## C. Order management — one follow-up detail

- [ ] Once a sample is approved in Uniform Replication, should it **automatically become a real order**, or stay a manual step?

**Resolved 2026-09-25**: Manual Order Entry is removed entirely — Admin never creates orders directly. Every order's invoice/PO comes exclusively from QuickBooks, synced into the portal for display.

**Resolved 2026-09-25 (2nd session)**: Uniform Replication (tech pack creation) is Sales Rep/Admin-only — customers never access the creation tool directly, only rep-mediated requests and finished results.

## C2. Two new conflicts from today's second meeting — need your direct answer, not assumed either way

- [ ] **Certificate requests**: does the request go to the **sales rep first** (who loops in admin + manufacturer), or **directly to admin** (with a "Request Certificate" button on the orders page)? Your two sessions today said each of these.
- [ ] **QuickBooks scope**: is QuickBooks integration still **read-only** (order/invoice history, as you confirmed on 2026-09-18), or does it now also **handle payments via bank transfer**, as mentioned in today's second session? These are very different builds.
- [ ] **"Catalog ordering functionality"** — how does this relate to the decision to remove the example product catalog from the portal? Is this a different, real orderable catalog?

## D. Notifications & internal communication

- [ ] For notifications (new order, sample ready, certificate ready, etc.) — **should these also send an email**, or just show in the app? Different rules for different event types?
- [ ] Do you want a way for **Admin to message a rep internally** about a specific order — separate from the customer-facing chat — or is that better handled outside the app (Slack, phone)?
- [ ] Should admin accounts be **flat** (everyone equal) or **tiered** (a "Super Admin" — probably you — who controls who else gets admin access)?

## E. Sales Hiring — one open detail

- [ ] The resume-screening tool's scoring criteria are currently hardcoded for sales-rep hiring specifically. **Will this tool only ever be used to hire sales reps, or might you use it for other roles too?** (affects whether the scoring criteria need to become editable per job posting)

**Resolved 2026-09-25**: no direct/organic self-signup at all — every customer account now comes from either a rep's invite link or Admin creating it directly, so the "no rep link" edge case can't occur. The written commission/territory SOP document is removed from the admin portal and delivered as a separate PDF instead.

## F. Current setup & migration

- [ ] What are you using **right now** to manage customers and orders — Excel, QuickBooks alone, another CRM, or a mix?
- [ ] At launch, do you want a **one-time import of your existing customer/order history**, or start fresh?
- [ ] If importing — roughly **how many customers/orders**, so we can scope the cleanup needed?
- [ ] Is there a **target go-live date** in mind?

## G. Import CSV — real-world workflow

- [ ] The bulk-import tool's fields look like **production/batch-tracking data** (materials, QC, safety certs), separate from sales orders. Is that right? **Could you send us a real sample of the spreadsheet you use today**, so we build the import to match your actual format?

## H. Product catalog

- [ ] Right now, updating the catalog PDF needs a developer. **Do you want the ability to upload a new version yourself?**

## I. Access we need from you

- [ ] **QuickBooks** login/API access, when ready to connect it
- [ ] **Okay to set up a separate practice/staging version of the database**, so we never risk touching real customer data while building?
- [ ] A few **real tech-pack example files**, to tune the AI feature to match your actual format

---

## Not part of this meeting (deliberately parked)
- Your marketing site (rivix.ca) and its Webflow/GoHighLevel setup — confirmed out of scope for now
