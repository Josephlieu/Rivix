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

## C3. Supplier Hub (requested 2026-09-29) — ANSWERED 2026-09-30, a few new questions remain

Joseph's written answers are recorded in [17-supplier-hub.md §0](./17-supplier-hub.md).

**Answered**
- [x] Customers submit inquiries? → **No. Admin only** uploads the RFP/tender and chooses which manufacturers can see it.
- [x] AI decides or recommends? → **AI picks the winner; admin can always override.**
- [x] First response or best bid? → **Best bid**, with a deadline; compare price, lead time, supplier performance; response time is still tracked; admin can close/award early.
- [x] 2FA, audit logs, quote history? → **Yes to all**, plus records of quote changes, who viewed/downloaded files, and who awarded.
- [x] "The supplier can go and choose and decide"? → the supplier **accepts or declines** the opportunity, then enters price and lead time.
- [x] Tech-pack leakage? → **NDA per supplier, invite-only visibility, no competitor names, file access expiring at close, admin can revoke, download logging, watermarking** with supplier name.
- [x] Create an RFQ from a Replication tech pack? → Not needed: admin uploads the tender; AI drafts a tech file from written specs when none exists.
- [x] Priority? → **After** the customer, admin and sales-rep sides are live.
- [x] QuickBooks Online? → **Yes**, invoices only; match by email first, then save the QuickBooks customer ID.

**New questions from his answers — ask Joseph only the BUSINESS ones** (technical ones we decide ourselves, see `17-supplier-hub.md` §0b)
- [ ] **NDA wording:** can you (or your lawyer) send the NDA text? One NDA for every supplier? *(how it is signed is our call)*
- [ ] **AI screening criteria:** which certifications can your suppliers meet or not, minimum quantities for custom manufacturing, any regional / union / Canadian-made rules? *(an editable criteria page in the app is our call — yes)*
- [ ] **Winner notification:** told **immediately**, or after a short admin review window so you can override first? (we recommend the window)
- [ ] **Negotiation round:** should you approve each "can you improve your offer?" message, and how many rounds? (we suggest: you approve, up to 2 rounds)
- [ ] Are **losing suppliers told** they weren't selected? (we suggest: yes, never the winner or the price)
- [ ] **CAD or USD**, and landed price only or explicit shipping terms?
- [ ] **Where do the tenders come from?** (the example looks like a Government of Ontario / Ontario Parks tender — is that the kind you bid on?)
- [ ] **Whole tenders or selected styles:** the example has 57 garments. Do you bid on the whole tender or pick styles, and can a supplier quote only part of it?
- [ ] **Main RFP:** do you have the full RFP that goes with the Ontario Parks attachment (closing date, evaluation, mandatory forms) so we can test screening on a real one?
- [ ] **Sizes:** should **tall** and **maternity** be separate options on the order form?
- [ ] **AI bill:** whose account pays for the AI (screening, summaries, tech-file drafts, bid comparison), and is a monthly cap wanted? Also **storage:** tenders as big as the example (64 MB) need a paid storage plan — okay to include that monthly cost?
- [ ] **Email domain:** supplier emails need rivix.ca connected for sending (Resend + GoDaddy DNS) — see section I.

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

- [ ] **QuickBooks** login/API access, when ready to connect it (confirmed 2026-09-30: QuickBooks Online, invoices only)
- [ ] **Okay to set up a separate practice/staging version of the database**, so we never risk touching real customer data while building?
- [ ] A few **real tech-pack example files**, to tune the AI feature to match your actual format (2026-10-01: received — Ontario Parks tender attachment; more examples of different garment types still welcome)
- [ ] **Hosting costs:** a real launch will likely need paid plans for the database/storage (Supabase, ~$25/month) and hosting (Vercel, ~$20/month per person), plus AI usage — see `05-environment-setup.md` "Running costs". Is that okay? And for the **existing production Supabase project**: which plan is it on, who pays for it, and are backups on?
- [ ] **DNS access for rivix.ca (GoDaddy)** so branded emails can send through Resend — now also needed for supplier notification emails. Plan: we send the DNS records for Joseph to paste, or he adds us as a delegate; never share the password

---

## Not part of this meeting (deliberately parked)
- Your marketing site (rivix.ca) and its Webflow/GoHighLevel setup — confirmed out of scope for now
