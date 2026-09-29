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

## C2. Answered by Joseph on 2026-09-29

- [x] **Certificate requests** — resolved: customer asks their **rep → rep pings admin → admin uploads the file → customer sees it.** Files can be any related document (fabric detail sheets, CSA certificates, etc.), not just the 3 fixed cert types.
  - [ ] Small follow-up: should the customer still get a "request" button (that notifies their **rep**, not admin), or do they just ask the rep directly?
- [x] **QuickBooks** — resolved: **invoices only, read-only**. Low data volume doesn't matter for the integration.
  - [ ] Confirm they use **QuickBooks Online** (not Desktop) — the integration only works with Online.
  - [ ] How should QuickBooks customers match to portal customers — by email, or admin links them once?
- [ ] **"Catalog ordering functionality"** (from the 09-25 second call) — still unanswered. Is this a real orderable catalog, separate from the example catalog we removed?

## C3. NEW — Supplier Hub (requested 2026-09-29) — need Joseph's answers

- [ ] **Context: the PDF is ChatGPT's write-up of your brief, so several details are ChatGPT's, not yours** — worth confirming each is what you want. First: it lets the **customer** "submit product inquiry, upload requirements, track status." You only mentioned the "buyer side" in passing, and this contradicts the decision that customers go through their rep. **Do customers submit inquiries themselves, or does the rep enter them?**
- [ ] **AI**: you said it should be able to decide by itself; ChatGPT advised against auto-award (recommend, admin approves). **Which do you want — or recommend by default with an auto-award switch you can turn on?**
- [ ] **"The first one who can put the pricing in"** — first-to-respond wins, or best bid after a closing deadline? (The deadline and locked bids were ChatGPT's addition.)
- [ ] ChatGPT also added **2FA for admins, audit logs, and version history on quotes**. Wanted, or overkill for launch? (Each adds hours.)
- [ ] You ended with "the supplier can go and just choose and decide" — **what does the supplier choose?**
- [ ] Are **losing suppliers told** they lost? Ever told the winning price? (Proposed default: told only that they weren't selected.)
- [ ] **Tech packs go to up to 50 outside companies.** Any NDA, access expiry per RFQ, or download logging wanted, given the earlier worry about designs reaching competitors?
- [ ] Should RFQs be created **from a tech pack already made in Replication**?
- [ ] **CAD or USD**, and landed price only, or explicit shipping terms?
- [ ] Priority: does this come **after** the Customer / Admin / Sales Rep launch (recommended), or in parallel?

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
