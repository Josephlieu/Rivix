# 18 — Order flow (how an order works after launch) and build status

Written 2026-09-30. This is the working record of the order flow: what Joseph confirmed, what is built, what is next. Sources: `07-client-requirements.md` §0, §8d, §11 (Joseph's answers of 2026-09-24, 09-25, 09-29).

## The flow (all steps from Joseph's confirmed answers)
1. **Admin creates the customer** and assigns one sales rep. *(built)*
2. **Customer talks to their rep** (phone/email). The customer does **not** create orders or touch production in the portal — they only view.
3. **Rep creates the order** for that customer: products, quantities, sizing, branding, delivery location, PO number, pricing, special requirements. *(built)*
4. **Admin runs everything operational after that:** confirms the order, moves it through the stages, supplier/factory, shipping and tracking, notes, documents/certificates. The rep never chases the factory. *(next)*
5. **Customer and rep follow progress read-only.** The rep passes updates on to the customer; admin only joins the customer conversation for serious issues, with the rep always included. *(rep view built; customer view to upgrade)*
6. **Delivered → admin uploads certificates/documents on the order;** the customer downloads them. *(after step 4)*
7. **Invoice and PO come only from QuickBooks** (display-only sync); nothing is created by hand in the app. Waits on QuickBooks access and confirmation it is QuickBooks Online.

Admin does **not** create orders ("Manual Order Entry" was removed 2026-09-25). That means order creation is tested by signing in as a rep.

**Example:** Pacific Mining wants 50 hi-vis jackets → they call their rep → the rep enters the order (sizes, logo, delivery, PO) → it is saved as `ORD-000x`, stage *Order Received* → admin moves it through Sampling, Production, QC & Packaging, Shipped (adds carrier + tracking) → customer and rep watch progress → on Delivered, admin uploads the certificates.

## Stages (fixed list, enforced by the database)
Order Received → Sampling & Approval → In Production → QC & Packaging → Shipped → Delivered, plus Cancelled. Matches RIVIX's real 4-stage process (Sampling & Approval → Sourcing & Production → QC & Packaging → Logistics & Delivery).

## Data model (`deliverables/dev-schema-order-flow.sql`, `dev-schema-order-sizes.sql`, run on dev)
- `orders`: existing columns + `rep_id`, `delivery_location`, `po_number`, `pricing` (free text, **reference only** — the real invoice is in QuickBooks; free text because CAD/USD is still open), `special_requirements`, `carrier`, `tracking_number`; status default *Order Received*; status check constraint; order number auto-generated `ORD-0001…` when left empty (existing `RVX-…` numbers untouched).
- `order_items`: one row per product — name, quantity, `sizing` (readable text), `size_breakdown` (jsonb `[{size, qty}]`), branding, position.
- `order_events`: the timeline. Every stage change is logged by a database trigger; a note can be marked *internal* (`customer_visible = false`) so customers never see it.
- Security: customers can only **read** their own orders/items/visible events (RLS). No write policies for browsers. Reps and admin write through server routes that check the role first (service role).

## Size grid
Each product on the rep's form has XS–4XL boxes plus "Custom size" rows (numeric sizes, "One size"). Quantity is never typed — it is the sum of the sizes, so they can't disagree. Open question for Joseph: are sizes always S–4XL, or are there other sets (kids, numeric, women's cuts)? Until answered, standard set + custom rows.

## Codes
Human-friendly unique codes sit next to the internal database id: customers `CUS-0001` (switched from name-based `PAC-0001` on 2026-09-30 because name-based codes go stale on rename), reps `REP-0001` (`rep_code`), orders `ORD-0001`. Codes never change once issued.

## Build status
| Piece | Status |
|---|---|
| Order database, stages, timeline, order numbers | Done (dev) |
| Rep creates an order (multi-product, size grid, validation, rollback on failure) | Done, script- and browser-tested |
| Rep portal (overview, customers, customer page, orders, order detail read-only, account) in the customer-portal layout | Done |
| Admin Orders page + order detail (change stage, tracking, notes, timeline) | **Built 2026-10-01**, script-tested (27 checks pass); browser look not yet checked by me |
| Customer order page: items with sizes, stage timeline, tracking | **Built 2026-10-01** (the old generated placeholder certificates were removed 2026-10-01; the page shows "No documents yet" until uploads exist) |
| Documents / certificates on an order | **Built 2026-10-01** (private Supabase bucket, direct-to-storage upload, checked download links); 33 script checks pass; upload form not yet clicked through in a browser |
| Rep "request a document" (ping admin) + in-app notifications for all three roles | **Built 2026-10-03**, 35 script checks pass; bell and request form not yet seen in a browser; email notifications not built |
| Rep version of Uniform Replication (internal tool) | Later, big |
| Rep-shared sign-up link for new customers | Later |
| QuickBooks invoice/PO display | Blocked on Joseph |

## Plan: admin Orders page (estimate ~7–9h)
Today `/admin/orders` is fake: 3 hardcoded orders, a dead "Manual Order Entry" button, and a "Generate Certs" button that only pretends. Nothing a rep creates appears there.
1. **Real list** of all orders from all reps: order #, customer, rep, product, quantity, stage, date; search + filters (stage, customer, rep); "View details". Remove the fake data, the Manual Order Entry button and the fake Generate Certs.
2. **Order detail** `/admin/orders/<id>`: everything the rep entered; change stage (dropdown, confirmation for Cancelled/Delivered; every change on the timeline); carrier + tracking number; add a note to the timeline (customer-visible or internal); timeline with date and who; a placeholder for documents.
3. **Customer and rep see it:** the rep order page updates automatically; the customer's order page is upgraded (items + sizes, stage timeline, tracking); the order list on Client Detail becomes clickable into the admin order.
4. **Tests:** only admin can change a stage (customer/rep refused, invalid stage refused); each change lands on the timeline; internal notes never reach the customer; the customer sees the change.
Defaults assumed unless Joseph/user says otherwise: admin may move an order back a stage (all changes logged); a cancelled order can be reopened.

## What the rep dashboard still lacks (honest status, 2026-09-30)
Core job (see customers, create orders, follow orders) works. Missing: real progress (needs the admin Orders page — every order sits at *Order Received* until then), documents from admin, "ping admin", notifications (bell is empty), the rep Replication tool, and a rep-shared sign-up link.
