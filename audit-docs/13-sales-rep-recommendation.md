---
title: Sales Rep Role — Recommendation
---

# Sales Rep Role — Our Recommendation

Since this role doesn't exist at all today, this is our proposed design if you move forward with building it — pulling together everything we've discussed into one clear recommendation, rather than scattered notes.

---

## 1. Each rep gets their own real login
Not a shared password like admin has today — every rep (Tyler, and the ~9 others) gets an individual account with their own email and password. This means we always know exactly who did what, and we can remove one person's access without affecting anyone else.

## 2. How a rep gets connected to a customer
We recommend **three ways in**, all leading to the same result — a real link between a specific customer and a specific rep:

- **A rep shares their own invite link** with a lead (matches how you described reps working today — cold calls, email outreach). The customer signs up through that link and is automatically connected to that rep.
- **Admin creates the account directly** — for phone-in customers, admin enters their details, picks which rep to assign, and the system emails the customer their login.
- **A customer signs up on their own**, with no link — lands in an "unassigned" queue that admin reviews and assigns manually, rather than being blocked or lost.

In every case, admin can always **reassign** a customer to a different rep later, no matter how they originally joined.

## 3. What a rep sees and can do — CONFIRMED by Joseph (2026-09-24)

The rep's job is **selling and owning the customer relationship — not order coordination.** Confirmed division of labor:

- **Overview**: personalized greeting, their own stats (how many clients, orders, pending requests)
- **My Clients**: only the customers assigned to them — nobody else's
- **Orders**: the rep **creates** new orders here — full details (products, quantities, sizing, branding, delivery, pricing, PO, special requirements). Once submitted, the rep can **view** full status/documents/certs/tracking/notes throughout, but does not do the operational work — that's admin's job (supplier communication, confirmations, production, QC, shipping, delivery). The rep should never have to chase factories, freight, or certificates themselves.
- **Certificates**: rep can see certificate status for their orders; admin handles the actual upload/fulfillment
- **Uniform Replication**: their clients' requests — reviewing specs, generating tech packs, chatting with the customer
- **Messages**: direct chat with their own customers stays the default — this is the rep's main job. Admin only steps into a conversation for serious/technical/compliance/payment issues, and the rep always stays copied/included, never bypassed.

## 4. Admin actively manages, not just oversees — CONFIRMED

Admin's role isn't passive monitoring — admin **actively runs the operational side of every order** from submission through delivery: supplier communication, confirmations, artwork/sample approvals, certifications, production status, QC, shipping/tracking, status updates, delivery confirmation, and any internal issues (factory, freight, documentation). Admin retains full visibility and edit access across every rep and every customer, and can join any conversation when needed.

**One-line summary of the whole model**: Rep sells, submits the order, manages the relationship, and follows along. Admin runs everything operational behind the scenes and keeps the rep updated through the portal.

## 5. Territory and commission — a real decision point
We found an actual commission and territory policy already written up in your system (splitting Alberta into zones, with account ownership expiring after 12 months of no activity). **This needs your confirmation**: should the app actually enforce these rules automatically (auto-releasing a customer back to an open pool after 12 months of no orders, assigning by territory/postal code), or is that policy more of a guideline your team applies manually for now? This changes how much we build into the system versus leave as a manual process.

## 6. Why this order of dependencies matters
None of this works unless it's built in the right sequence:
1. Real customer accounts must exist first (already scoped as part of the Client Directory rebuild)
2. Then the rep-to-customer link can be established
3. Then a rep's dashboard can correctly filter by that link
4. Then orders, certificates, and replication requests can correctly show up in the right place for the right person

Building the Sales Rep pages without this underlying connection first would just recreate the same problem we found everywhere else in the app — pages that look right but show the wrong (or no) data.

---

## What we'd want from you before starting this
- ~~Confirmation this overall approach matches what you had in mind~~ — **confirmed 2026-09-24**, order management split fully answered
- An answer on the territory/commission enforcement question above
- Confirmation on the "unassigned customer" edge case (queue for admin, as proposed)
