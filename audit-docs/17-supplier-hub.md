---
title: Supplier Hub (Supplier Procurement Portal)
---

# Supplier Hub — full write-up

Requested by Joseph on 2026-09-29. This is a **new feature**, separate from the Customer / Admin / Sales Rep work. The short version lives in [07-client-requirements.md §13](./07-client-requirements.md); this file is the complete record.

## 0. Joseph's answers (2026-09-30) — these supersede ChatGPT's proposal wherever they differ

Joseph replied to the C3 questions in writing. **These are now the confirmed requirements** for the Supplier Hub. It is a bigger and different feature than the ChatGPT deck: it starts with **RFPs/tenders** RIVIX receives, screens them with AI, then sources bids from manufacturers.

### The confirmed flow
1. **Admin uploads the tender / RFP.** Admin only — customers and reps do **not** submit inquiries. (Resolves the old conflict.)
2. **AI screens it first** against criteria the admin sets, and returns **GOOD / POSSIBLE / POOR MATCH**, explains why, and recommends **Proceed / Review Before Proceeding / Skip**. Admin makes the final decision. Things it must flag: a specific manufacturer/brand required with no equivalent; closing date too soon; unrealistic sample deadline; too many mandatory forms/registrations; certifications our suppliers can't meet; Canadian-made / union-made / geographic restrictions; past-project requirements we don't meet; quantity too small for custom manufacturing; unrealistic delivery timeline; unusual testing/inspection; no substitutions allowed.
3. **If admin proceeds, AI summarizes the tender** and extracts what a manufacturer needs to quote on: product requirements, quantity, materials, certifications, delivery, dates, photos, files, special instructions.
4. **If there are only written specs** (no photos / tech pack), **AI drafts a tech file** from the written requirements plus the **example tech file Joseph already sent**. Admin reviews it before it goes live to suppliers.
5. **Admin selects suppliers** (each supplier only ever sees tenders they're invited to; suppliers never see who else was invited).
6. **Suppliers get an email** with a short AI summary: product type, approximate quantity, key specs, quote deadline, required delivery timeline, major certification requirements. They log in to see the full tender.
7. **In the portal a supplier can:** view the tender, AI summary, photos/files and tech file; **accept or decline**; enter **price and lead time**; add notes/conditions; upload supporting files; submit the final bid; **ask questions** (through the tender page, by email, or by requesting a quick call) — admin replies. Admin can also **send an update to every supplier on that tender** if something changes.
8. **Best bid wins, not first response.** Suppliers have a **deadline**. Compare on price, lead time and supplier performance. **Response time is still tracked** (becomes part of a supplier score later). Admin can close or award early.
9. **AI picks the winner** (price, lead time, supplier history, other factors added later). **Admin can always override.**
10. **Negotiation round:** once the best bid is identified, admin can tell the other suppliers where the leading bid sits ("Current leading price: $X, lead time: X days — can you improve your offer?"). They **never** see the winning supplier's name or any confidential information.
11. **Winner is notified and confirms.** Everything is saved to the tender history and the supplier performance record.

### Security and design protection (all confirmed — "yes")
- **2FA for admin**, activity logs, quote history, record of quote changes, record of who viewed/downloaded files, record of who awarded the tender.
- **Every supplier signs an NDA before they can access tenders, tech packs or confidential files.** NDA acceptance is recorded on the supplier account with the date.
- A supplier only sees tenders they're invited to; can't see other invited manufacturers or competitors' names; can't see customer information (unless allowed) or RIVIX's selling price / margin.
- **File access can expire** when the tender closes; **admin can remove access at any time**; **downloads are logged**; **tech packs and sensitive files watermarked** with the supplier company name/account if possible.

### Other answers
- **Timing:** build **after** the customer, admin and sales-rep sides are live. (Confirms the recommendation.)
- **QuickBooks:** **QuickBooks Online — confirmed.** Only for invoices right now. Match customers by email at first, but **once matched, save the QuickBooks customer ID on the portal account** so a later email change doesn't break the link.

### What this changes
- **Scope grew a lot.** The earlier Phase-1 estimate (~74–108h, RFQ + quotes + comparison) no longer fits. See the revised estimate in §10b.
- The old questions are answered: inquiries = admin only; AI decides but admin overrides; best bid + deadline (+ response time tracked); 2FA/logs/history wanted; NDA + access expiry + download logging wanted; "the supplier can go and choose and decide" = supplier **accepts or declines** the opportunity.
- **Email is now a hard dependency.** Supplier notification emails need a properly verified sending domain (Resend + rivix.ca DNS via GoDaddy). Supabase's default sender is rate-limited and unbranded and will not do.
- **The example tech file:** received 2026-10-01 — an Ontario Parks uniform tender attachment (57 garments, 723 pages, 64 MB). Analysis in [19-tech-pack-example.md](./19-tech-pack-example.md): the draft tech file should follow its 11-section layout; it also shows what real tenders look like (Made-in-Canada, bilingual labels, CGSB/CSA/ISO/AATCC testing, Pantone colour control, tall/maternity sizes), a tender can hold **57 line items** (design for many products per tender, partial bids), and a 64 MB file may exceed the Supabase free-plan 50 MB upload limit (verify).
- The old items about customer inquiries, "create an RFQ from a Replication tech pack", and the ChatGPT "buyer side" are **superseded / dropped**.

### Still open (new questions from these answers)
1. **NDA:** what is the NDA text (Joseph / his lawyer), and how is it "signed" — a click-to-accept box, or an uploaded signed PDF / e-signature? Same NDA for every supplier?
2. **AI screening criteria:** Joseph said "criteria we set." Which certifications can RIVIX's suppliers meet or not, minimum quantities for custom manufacturing, regions/restrictions — who maintains this list, and should admin be able to edit it in the app?
3. **Winner notification:** after AI picks, is the winner notified **immediately**, or does admin get a review window first (recommended) so an override can happen before anyone is told?
4. **Negotiation round:** does admin approve each "can you improve?" message, or does the system send it automatically? How many rounds?
5. **Losing suppliers:** are they told they weren't selected? (Not answered; default: told only that they weren't selected.)
6. **Currency:** CAD or USD? (Not answered.)
7. **Where do the tenders come from?** Government/public tenders that RIVIX receives and bids on? This affects the screening rules and how documents arrive.
8. **AI cost:** screening, summarizing, drafting tech files and comparing bids all use paid AI calls per tender — who pays the Gemini/AI bill (the existing key problem), and any monthly cap?

### 0b. Technical decisions we make ourselves (not for Joseph) — proposed 2026-10-01
| Question | Our decision |
|---|---|
| How is the NDA signed? | Click-to-accept in the portal with the supplier's **typed full name**, the **NDA version**, date/time and IP stored on the supplier account; supplier can't open any tender until it's accepted. Optional uploaded signed PDF later if his lawyer insists. |
| Editable screening criteria? | **Yes** — an admin settings page holds the criteria (certifications suppliers can't meet, minimum quantities, restricted regions, etc.) and the AI is prompted from it. Joseph supplies the *content*; we build the editor. |
| Reading very large tenders | Chunk by section/garment, summarise each piece, then combine; keep the original file private. Choose the AI model for cost vs quality at build time. |
| Big files (64 MB example) | Needs a storage plan that allows files over 50 MB (verify the Supabase free-plan cap); cost passed to the client as a running cost. |
| Partial bids / many products per tender | Model a tender as **many line items**; a supplier can accept/decline and quote **per item or the whole tender**. |
| Admin 2FA | Authenticator-app (TOTP) for admin accounts. |
| Logs | One activity log (who viewed/downloaded, quote changes, who awarded) plus a version history on quotes. |
| File protection | Short-lived private links, access that ends when the tender closes, admin can revoke, downloads logged, supplier name stamped on PDFs/images (watermark). |
| AI draft tech file | Follow the 11-section layout of the Ontario Parks example; mark it clearly as a **draft** and require admin review before suppliers see it; measurements always need a person's check. |

## 1. Where this came from (read this first)

Three inputs, and they are not equal:

1. **Joseph's spoken brief**, transcribed. He recorded it (Friday, 11:31 PM) and put it into ChatGPT. This is the only part that is genuinely his.
2. **ChatGPT's reply** to that brief (shared chat, pasted in full).
3. **A concept PDF**, `RIVIX_Supplier_Procurement_Portal_Concept_Final.pdf` (in the project root, 10 pages), which is ChatGPT's reply turned into slides.

So the PDF and the chat are **ChatGPT's proposal**, not Joseph's confirmed requirements. Where they differ from his words, his words win, and the difference is recorded rather than adopted silently. Nothing here has been confirmed with Joseph line by line.

## 2. Joseph's own words, condensed

- Add another platform inside the portal, only for **suppliers (manufacturers)**.
- Admin side: put the **tech pack, MOQ, fabric, specs** together in one place.
- Access for **up to 50 suppliers**. Each has a **separate entrance**; nobody can see what anyone else is doing.
- Supplier reviews the inquiry and comes back with **price and lead time** (e.g. lead time 14 days), plus fabric composition, GSM, and "our pricing with logistics, everything altogether."
- **"The first one who can put the pricing in"**; if the price is lower or the lead time makes more sense, they are awarded the production.
- **Either the AI decides for us, or we decide manually.** "AI should be able to do it by themselves... they must be able to do it, but we will be able to manually do it too." An admin can always pick a different supplier: "complete sovereignty or independence."
- **Onboarding:** admin emails a link; the supplier puts in their **company name** (e.g. Spartan Industries, Islam Industries, CL Code), which creates their account; they **choose their own password**. Admin has a separate password.
- He also said "there should be another password that's okay for all" — this line is garbled and was not explained.
- Closing line: the portal is good for "the buyer side, the supplier side, and the admin side." He also said "from there the supplier can go and just choose and decide" — unexplained.

## 3. What ChatGPT / the PDF added (not Joseph's words)

| Topic | Joseph said | ChatGPT / PDF added |
|---|---|---|
| Names | "supplier part" | "RIVIX Supplier Hub" and "Procurement Command Center" (admin), modules for RFQs, Quotes, Production Orders, Documents, Messages, Performance |
| Award rule | "The first one who can put the pricing in"; lower price / better lead time wins | Quote **closing deadline**, submit button disabled after it, **locked bids**, **version history** |
| AI | AI can decide by itself, admin can override | "I would not let AI automatically award production." Recommend-only is ChatGPT's advice |
| Passwords | Each chooses their own; "another password okay for all" (garbled) | No shared password at all; each supplier fully separate |
| Buyer side | Mentioned once at the end | Customer submits inquiry, uploads requirements, tracks status, receives outcome |
| Security | Suppliers can't see each other | Admin 2FA, audit logs, session expiry, backups, encrypted passwords; suppliers can't see how many were invited or who submitted first |
| Invite form | Supplier enters company name | Admin enters company, contact person, email, phone, country, factory location, product categories, status |
| Everything after "buyer side" | — | Production order tracking, QC records, shipment tracking, messaging, performance scoring |

## 4. The proposed flow (ChatGPT's version, marked where it goes beyond Joseph)

### Step 1 — Admin creates an RFQ (request for quote)
Fields: RFQ number, product name / style number, **tech pack**, measurements, **fabric composition**, **GSM**, colour, quantity, **MOQ**, required certifications, embroidery/print requirements, packaging requirements, delivery location, required delivery date, special instructions, **quote closing deadline** *(ChatGPT)*, and file uploads (PDF, Excel, images, technical files).

Admin then **selects which suppliers can see it** (10, 20, or all 50).

### Step 2 — Supplier logs in
Own account, own email and password. A supplier sees **only their own dashboard**: their open RFQs with product, quantity, deadline, status.

**A supplier must not see:** other suppliers' names, prices, lead times, the number of suppliers invited, who submitted first, competitor bids, Rivix's internal evaluation, AI recommendations, admin notes.

### Step 3 — Supplier submits a quote
Standard fields so every proposal is comparable:

| Field | Example |
|---|---|
| Fabric composition | 65% polyester / 35% cotton |
| GSM | 300 |
| MOQ | 500 pcs |
| Unit manufacturing cost | $18.40 |
| Packaging | $0.60 |
| Embroidery | $1.20 |
| Logistics | $2.50 |
| **Total landed cost** | **$22.70** |
| Production lead time | 14 days |
| Shipping lead time | 7 days |
| **Total lead time** | **21 days** |
| Payment terms | 30 / 70 |
| Quote validity | 30 days |
| Notes, supporting documents | upload |

Button: **Submit Proposal**. The submission is timestamped. A supplier **cannot delete** a submitted quote; before the deadline they may revise it, and the original stays in the record *(ChatGPT)*.

### Step 4 — AI evaluation
AI puts every quote on the same basis and checks: technical compliance, fabric and GSM match, total landed cost, lead time, MOQ, payment terms, certifications, supplier history, capacity, required delivery date.

AI returns: recommended supplier, reason, risk flags, missing information, best-cost option, fastest compliant option.

### Step 5 — Admin decides
Admin can: approve the recommendation, **choose a different supplier**, request a revised quote, add an **internal note** (never shown to suppliers), and **award production**. Example override: AI recommends Spartan, admin awards Islam with the note "selected due to previous production quality."

### Admin dashboard
Per RFQ: status, suppliers invited, submissions received, pending, deadline. A comparison table (example from the deck):

| Supplier | Landed cost | Production | Total lead | MOQ | Status |
|---|---|---|---|---|---|
| Spartan Industries | $22.70 | 14 days | 21 days | 500 | Compliant |
| Islam Industries | $21.90 | 18 days | 25 days | 500 | Compliant |
| CL Code | $24.10 | 10 days | 17 days | 500 | Compliant |

Sort or filter by price, lead time, MOQ, fabric, GSM, payment terms, compliance, supplier performance.

### Supplier invitation
Admin uses an **Invite Supplier** form (company, contact, email, phone, country, factory location, product categories, status) and clicks Send. The supplier gets "You've been invited to the Rivix Supplier Portal," follows a secure link, creates their own password, and the account becomes active. This is deliberately **not** a shared password.

## 5. Security requirements (ChatGPT's list)

The deck's rule: **privacy must be enforced in the backend, not just hidden on screen.** A supplier must not be able to edit a URL like `/rfq/1047/supplier/23` and reach supplier #24's data.

- Access: separate supplier accounts, role-based permissions, admin-only controls, **admin 2FA**, session expiration
- Data protection: secure password storage, supplier data isolation, secure file storage, **audit logs**, backup and recovery
- Bid integrity: submission timestamps, closing deadlines, version history, no silent quote deletion, locked bids after the deadline

Fit with what we already have: the admin login today is a single shared PIN (Finding #4, already decided to replace with real individual accounts). Real admin accounts are a prerequisite for 2FA and audit logs.

## 6. Architecture (ChatGPT's diagram, in words)

Three portals over one database: **Buyer portal** (submit inquiry), **Admin portal** (create RFQ, upload tech pack, select suppliers, receive bids), **Supplier portal** (log in, view RFQ, submit quote). Quotes flow into **AI evaluation**, which produces a **recommendation** alongside **admin override**, and the admin **awards production** to a supplier.

## 7. Phasing

**Launch (the deck's Phase 1):** up to 50 supplier accounts; invite and login; RFQ creation and file upload; private quote form; deadline controls; admin comparison dashboard; AI recommendation; manual admin override.

**After launch:** supplier performance scoring, production order tracking, inspection/QC records, messaging inside each RFQ, shipment tracking, buyer status updates, automated reminders, more supplier capacity.

## 8. Open questions for Joseph (original list — **mostly answered 2026-09-30, see §0**)

Also in [16-meeting-questions.md](./16-meeting-questions.md) group C3.

1. **Does the customer submit inquiries themselves?** ChatGPT says yes; Joseph only said "buyer side." It contradicts the confirmed decision that customers go through their rep.
2. **AI: decide by itself, or recommend only?** Joseph wants it to decide; ChatGPT advised against. Suggested compromise: recommend by default, with an auto-award switch per RFQ. His call.
3. **First-to-respond, or best bid after a deadline?** The deadline is ChatGPT's addition.
4. Does he want **admin 2FA, audit logs and quote version history** at launch? Each adds hours.
5. **What does "the supplier can go and choose and decide" mean?**
6. Are **losing suppliers told** they lost? Ever told the winning price? (Proposed: told only that they weren't selected.)
7. **Tech-pack leakage:** tech packs go to up to 50 outside companies, the same worry that removed Replication from customers. NDA, per-RFQ access expiry, download logging?
8. Should an RFQ be created **from a tech pack already made in Replication**?
9. **CAD or USD**; landed price only, or explicit shipping terms?
10. **Priority:** after the Customer / Admin / Sales Rep launch (recommended), or in parallel?

## 9. Rough data model (my sketch, not from Joseph or ChatGPT — **§0 adds: NDA acceptance, tender screening results, Q&A, tender updates, activity log, negotiation rounds, watermarked downloads**)

- `suppliers`: company, contact, email, status, linked to a login
- `rfqs`: number, product, MOQ, fabric, GSM, quantity, delivery date, closing deadline, status, created by admin
- `rfq_files`: files attached to an RFQ (private storage)
- `rfq_invites`: which suppliers were sent which RFQ
- `quotes`: one row per supplier per RFQ, plus a version history of changes
- `awards`: which quote won, who decided, AI recommendation vs. admin choice, internal note

Supplier isolation would use the same database-level rule pattern already in place for customers (a supplier can only read rows tied to their own supplier id).

## 10. Rough size, Phase 1 only

| Piece | Hours |
|---|---|
| Supplier role, email invite link, own passwords, isolation rules | 12–18 |
| Data model: suppliers, RFQs, files, quotes (with versions), awards | 8–12 |
| Admin: build RFQ, upload files, select and invite suppliers | 12–16 |
| Supplier portal: RFQ inbox, detail, structured quote form, revise before deadline | 12–16 |
| Bid integrity: deadline lock, timestamps, version history, no deletion | 6–10 |
| Admin: comparison dashboard, manual award, revised-quote request, internal notes | 10–14 |
| AI recommendation (score, explain, risk flags, missing info) | 6–10 |
| Audit logs | 4–6 |
| Admin 2FA and session expiry | 4–6 |
| **Total** | **~74–108** |

A first estimate only. It includes the items ChatGPT added (2FA, audit logs, versioning) which Joseph may not want at launch. It excludes everything under "after launch." It sits on top of the ~211–306 hours already remaining elsewhere.

## 10b. Revised estimate after Joseph's answers (2026-09-30) — rough, my numbers

| Piece | Hours |
|---|---|
| Supplier accounts: invite by email, own passwords, **NDA acceptance recorded**, isolation rules | 16–24 |
| Data model: suppliers, tenders, files, invites, quotes + versions, awards, Q&A, updates, activity log | 12–18 |
| Admin: upload tender/RFP, choose suppliers, close/award early, remove access | 14–20 |
| **AI tender screening** (admin-set criteria, Good/Possible/Poor + reasons + Proceed/Review/Skip) | 14–20 |
| **AI summary + key-point extraction** from the tender (incl. reading PDFs) | 10–14 |
| **AI draft tech file** from written specs + the example tech file (needs the example) | 16–24 |
| Supplier notification email with AI summary (needs verified sending domain) | 6–10 |
| Supplier portal: tender view, files, accept/decline, price/lead time/notes/uploads, submit, revise before deadline | 18–26 |
| Deadline, early close/award, bid integrity | 8–12 |
| Supplier questions + call request + admin reply; broadcast updates to all suppliers on a tender | 10–16 |
| AI bid comparison + winner selection (price, lead time, history) + admin override | 10–16 |
| Negotiation round (anonymous "leading price / lead time — can you improve?") | 8–12 |
| Design protection: access expiry, revoke access, download logging, **watermarking** with supplier name | 14–22 |
| Activity logs: quote history, who viewed/downloaded, who awarded | 8–12 |
| Admin 2FA + session expiry | 6–8 |
| Winner notification + confirmation; supplier performance record (response time) | 6–10 |
| **Total** | **~176–264** |

Roughly 2.4× the first estimate (74–108h), because the brief now includes AI on both ends (screening and winner selection), AI-drafted tech files, negotiation, a Q&A channel, NDA and watermarking. **Highest-uncertainty items:** the AI draft tech file (depends on the example file and image-generation quality), watermarking, and reading arbitrary tender PDFs. Excludes the "after launch" list (production tracking, QC records, shipment tracking, full performance scoring). Ongoing AI usage costs are extra. Built **after** the customer/admin/rep sides, as Joseph agreed.

## 11. Recommendation

Build it as its own phase **after** the Customer / Admin / Sales Rep MVP, in line with the MVP-first decision. It reuses what those phases build anyway: real admin logins, invite links, private file storage, notifications. Building those first makes this cheaper, not just later.

Do not start it until Joseph has answered questions 1 to 3, since they change the data model and who the users are.
