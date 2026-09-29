---
title: Supplier Hub (Supplier Procurement Portal)
---

# Supplier Hub — full write-up

Requested by Joseph on 2026-09-29. This is a **new feature**, separate from the Customer / Admin / Sales Rep work. The short version lives in [07-client-requirements.md §13](./07-client-requirements.md); this file is the complete record.

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

## 8. Open questions for Joseph

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

## 9. Rough data model (my sketch, not from Joseph or ChatGPT)

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

## 11. Recommendation

Build it as its own phase **after** the Customer / Admin / Sales Rep MVP, in line with the MVP-first decision. It reuses what those phases build anyway: real admin logins, invite links, private file storage, notifications. Building those first makes this cheaper, not just later.

Do not start it until Joseph has answered questions 1 to 3, since they change the data model and who the users are.
