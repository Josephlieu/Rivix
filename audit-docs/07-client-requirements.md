---
title: Client Requirements (from kickoff call transcript)
---

# Client Requirements — Transcribed from Kickoff Call

Source: recorded call with Joseph (and Peter present). No formal written spec exists — Joseph confirmed this call *is* the spec ("I don't have a document of what to do, but maybe if you want to take this recording and transcribe it"). This document is that transcription, organized by topic, cross-referenced against what the audit already found.

## 0. The full pipeline — how every feature actually connects (2026-09-18)

RIVIX's own [Apparel Manufacturing Catalog](../public/pdf/RIVIX-Apparel-Manufacturing-Catalog.pdf) (`public/pdf/RIVIX-Apparel-Manufacturing-Catalog.pdf`) describes the real production process as 4 stages: **Sampling & Approval → Sourcing & Production → Quality Control & Packaging → Logistics & Delivery.** This lines up almost exactly with the status stages already built into the replication ticket UI (**Received → Mapped → Production → Shipped**) — confirming the app is meant to be a digital front-end for this exact pipeline, not a set of unrelated tabs.

**Full intended flow, end to end:**
1. **Product Specs** — customer browses the catalog (12 real categories: T-shirts/tops, hoodies, outerwear, bottoms, hi-vis, coveralls/FR wear, hospitality/chef wear, medical wear, school/corporate uniforms, sports/jerseys, scarves/accessories, branding/finishing) and picks a base style + rough customization options (fabric, size range, branding, custom details) before committing to anything
2. **Uniform Replication** — customer submits the actual custom request (exact fabric/GSM/color/branding placement/safety requirements, or photos if copying an existing garment) to **their assigned sales person** (see #1, #8) — this is production Stage 1, Sampling & Approval
3. **Sales person discusses and clarifies** with the customer via real messaging (currently simulated — see finding 7h)
4. **Sample produced and shipped** — matches RIVIX's real "free samples ready in 2 weeks" promise and the ticket's production→shipped stages
5. **Customer approves the sample**, or requests changes (loops back to step 3)
6. **Approval converts into a real bulk Order** — quantity, pricing, invoice/PO created in QuickBooks (see #4 and #6b) — moving into production Stages 2-4: Sourcing & Production → Quality Control & Packaging → Logistics & Delivery
7. **Once delivered, Compliance Certificates get uploaded** against that finished order (see #3)

None of these features can be meaningfully fixed in isolation — they're one pipeline, and the Team/Sales role + real assignment (#1, #8) is the connective tissue running through nearly every step.

## 1. Roles needed — confirms audit finding

Three roles, clearly distinct:
- **Admin** — upper management: Joseph, Peter, Sayem (~3 people). Full visibility.
- **Team / Employee** ("reps") — ~10 people currently. Each needs their **own individual login**, with restricted access (not full admin).
- **Customer** — client-facing, one account per client company (e.g. "Pacific Oil and Gas Company" used as the example throughout).

> "I don't feel like it's fully built out that way yet, so we'll need that."

**This confirms our finding exactly**: only Admin (shared PIN) and Customer exist today. What Joseph calls "Team"/"reps" is the role we were calling "Sales Person" — same gap, this is the correct name for it going forward. **Each team member needs individual login/identity — not a shared credential like the current admin PIN.**

## 2. Personalized dashboard greeting — NEW requirement, not currently built

- Customer login → **"Welcome, [Company Name]"** (e.g. "Welcome, Pacific Oil and Gas Company") — dynamic per the logged-in customer's actual company, not hardcoded.
- Team member login → **"Welcome back, [Employee Name]"** (e.g. "Welcome back, Tyler") — dynamic per the logged-in employee.
- Admin login → **no personalized greeting needed**, just the admin dashboard.
- Both customer and team dashboards should show **order counts** on the main overview page.

This directly explains why the current hardcoded "Welcome back, Pacific Mining Co." text exists — it's a placeholder for a feature that was never finished, not an accidental leak of one specific client's identity. Confirms finding #3 in the audit needs to become a real feature build, not just a bug fix.

## 3. Compliance Certifications — workflow clarified

- Customer requests a document by phone/email (e.g. "I need a certificate of origin / safety cert").
- **Admin/team manually uploads the file into the portal** once received from the manufacturer/factory.
- Customer then sees it in their portal.
- **CONFIRMED (client meeting, 2026-09-25, first session), three-way coordination**: customer requests a certificate **through their sales rep** → rep coordinates with **both admin and the manufacturer** → completed documentation gets uploaded. Refines §3's request flow below: the rep is the entry point for the customer's request (matching the confirmed "rep owns the customer relationship" model, §8d), not the customer going directly to admin.
- **⚠ OPEN CONFLICT — flagged, not resolved (client meeting, 2026-09-25, second session)**: the same-day follow-up meeting (with Sayem) stated the opposite — certificate submissions "would go directly to admin rather than sales representatives," with a specific action item: *"add a button on the orders page for customers to request certificates, which notifies admin."* This directly contradicts the rep-first flow confirmed just above in the earlier session the same day. **Needs Joseph's direct confirmation before we build either version**: does a certificate request go to the rep first (who then loops in admin), or does it go straight to admin with the rep just kept informed? Not assuming either way.
- **Wants it organized by month** (Jan–Dec) per order, so a customer can find "what did I order/receive documentation for in March" easily. **Refined (second session, 2026-09-25)**: also organize/group by **order**, differentiated by date and order number — likely meaning "by month, then by order" as already designed below, rather than a change to that structure.
- This is an **admin-side upload workflow that doesn't exist yet** — currently `/admin` has no certificate upload feature, and `/portal/certificates` only shows hardcoded/fallback data (per finding #3/3c).

### Proposed upload flow (2026-09-18, not yet confirmed with Joseph)
1. **Trigger**: customer calls/emails requesting a specific document (e.g. "Certificate of Origin for order RVX-2026-9421")
2. **Admin/team gets the file**: whoever handles the request (admin, or eventually the assigned sales person) contacts the manufacturer and receives the actual PDF
3. **Upload**: admin picks the client, the specific order/batch, the certificate type (Origin / Quality Inspection / Compliance), and uploads the file — month/date gets tagged for the "organize by month" requirement
4. **Visibility**: the customer sees only their own certificates, grouped by month, downloadable as the real factory-issued PDF — not a generated placeholder
5. **Optional**: notify the customer a new certificate is available — the app already has a `NotificationBell` component ([NotificationBell.tsx](../src/components/NotificationBell.tsx)) that's currently decorative; this would be a natural place to wire it in

**Depends on** (can't be built in isolation): a real `certificates` table in Supabase, file storage for the PDFs (Supabase Storage isn't wired up for this yet), real per-customer data scoping (same fix needed everywhere else in the portal), and a new admin-side upload UI (doesn't exist at all today).

### Request-side addition (2026-09-18) — customer-initiated requests, not just admin-driven uploads

Refines the flow above with a proper request mechanism instead of relying purely on phone/email:

1. **"Request Certificate" button on each order** — on `/portal/orders/[id]`, customer picks a cert type (Origin / Quality Inspection / Compliance), optionally adds a note, and submits — instead of calling or emailing.
2. **Assigned sales person gets notified** — two channels:
   - In-app via the existing `NotificationBell` component
   - Email via `RESEND_API_KEY`, which is already integrated elsewhere in this app (hiring emails) — reuse rather than a new integration
3. **Sales person fulfills the request** — picks it up from a "Certificate Requests" queue (new admin/team tool), gets the file from the manufacturer, uploads it against that specific request, marks it fulfilled.
4. **Appears in the customer's Compliance Certs page** once fulfilled.

### How the Compliance Certs page should look with multiple orders

Since a customer can have many orders, each needing multiple cert types, the page needs two layers of grouping — **by month first** (per Joseph's original ask), **then by order within that month**:

```
March 2026
  - Order RVX-2026-9421 — ArcticShield Coverall
      Certificate of Origin       [Download]
      Quality Inspection Report   [Download]
      Certificate of Compliance   Requested — pending
  - Order RVX-2026-8814 — Hi-Vis Vest
      Certificate of Origin       [Download]

February 2026
  - Order RVX-2026-9422 — ArcticShield Parka
      Certificate of Compliance   [Download]
```

- A status badge (**Ready** vs. **Requested/pending**) so the customer can see what's still outstanding
- A search/filter by order number, reusing the same pattern already built into "My Orders," for customers with a long order history

## 4. My Orders — QuickBooks integration requested (NEW)

- Real order flow: customer calls/emails Joseph/Peter → they place the order → **invoice + PO created in QuickBooks**.
- Joseph wants that QuickBooks data (invoice, PO, order history) to show up in the customer's portal automatically.
- Asked directly: *"Do you know if you're able to connect this with QuickBooks?"* — wants a keys/API integration if QuickBooks provides one.
- **This is a new scoped feature, not something in the current codebase at all.** No QuickBooks integration exists anywhere in the code we've reviewed.
- **Clarified (2026-09-18): this is NOT a payment integration.** Joseph explicitly said so on the call: *"Not really purchasing, but seeing their order history, right? Whatever they ordered."* Orders/invoicing continue to happen the existing way (phone/email → invoice + PO created directly in QuickBooks by Joseph/Peter). The integration's only job is to **pull that data into the customer portal as read-only order history** — no cart, no checkout, no payment collection. Still requires QuickBooks API credentials from Joseph's side to build.
- **Scope firmed up (2026-09-25)**: this is now the **exclusive source of invoices and Purchase Orders** shown anywhere in the portal — not just generic order history. Confirmed alongside removing Admin's "Manual Order Entry" entirely (see §8d): no invoice/PO is ever created manually inside the app, by admin or anyone else. The rep still submits the initial order/spec request in-app; admin then issues the real invoice/PO in QuickBooks as part of their operational work; that document syncs back into the portal for display. This makes the QuickBooks sync a harder dependency than before — the portal's order/invoice/PO display has no fallback without it.
- **NEW (second session, 2026-09-25): customer-facing "Request Invoice" feature.** Add a way for the customer to request an invoice, handled through QuickBooks (fits the same read/sync model as above — customer requests, QuickBooks is the source of the actual document).
- **⚠ OPEN CONFLICT — flagged, not resolved (second session, 2026-09-25)**: this same follow-up meeting also mentions *"QuickBooks integration for handling payments and purchase orders through bank transfers."* This reads as materially different from the "NOT a payment integration" confirmation directly above, which Joseph stated explicitly on 2026-09-18 ("Not really purchasing, but seeing their order history"). Possible readings: (a) scope has genuinely expanded to include payment collection via bank transfer, which QuickBooks would process outside the portal itself, with the portal just reflecting payment status — a plausible middle ground that wouldn't contradict "not really purchasing" in the portal's own UI; or (b) this is a scope change that needs to be confirmed and estimated as new work. **Needs Joseph's direct confirmation** — not assuming either reading. If real, this is a meaningfully bigger integration than read-only order/invoice history.
- **NEW, also flagged for clarification: "catalog ordering functionality"** was mentioned in the same meeting alongside QuickBooks. This may be in tension with the "remove product/uniform spec examples from the customer portal entirely" decision in §5 below — or it may be a different thing entirely (a real, orderable product catalog vs. the *generic/example* spec content being removed). Needs Joseph's confirmation on what "catalog ordering" means before scoping it.

## 5. Product Specs / Tech Pack — AI image generation requested (NEW, bigger than current build)

- Wants an **AI-generated "tech pack" image**: a visual breakdown of a garment (logo placement, safety standard, reinforcement type, reflective material, exact placement of each element) generated from a structured spec/prompt.
- Purpose: send to factories for manufacturing **and** show the customer what they're getting.
- Confirmed as buildable (AI image generation from structured prompt/spec) — but **this doesn't exist in the current codebase.** The existing `/portal/products` page only shows static hardcoded spec text, no image generation.
- Note: `GEMINI_API_KEY`-backed routes (`analyze-garment`, `analyze-resume`) exist for *analysis*, but nothing for *generating* a tech pack image yet — this would be new work, possibly extending `garmentAiAnalysis.ts`.

### Purpose and intended behavior of this page (2026-09-18)

The page currently blends two different jobs into one screen:
1. **General catalog reference** — "what RIVIX can make" (currently a static embedded PDF viewer, `ProductCatalogEmbed`)
2. **This customer's contracted specs** — the exact garment specs a specific client has agreed to, so they can verify what they're getting (currently one hardcoded product card, identical for every customer, not tied to any real contract)

**Proposed tech pack generation flow:**
1. Customer or admin fills in a structured spec form: logo placement, safety standard, reinforcement type, reflective material, hardware, and where each element goes on the garment
2. Click "Generate Tech Pack" → an AI image-generation call produces a visual technical breakdown of the garment (matching the reference example Joseph showed live on the call)
3. That image is used two ways: sent to the factory for manufacturing accuracy, and shown to the customer to confirm before production

**Reuse note:** this is the same underlying capability Uniform Replication needs (see #6 below) — Product Specs would generate tech packs for **existing/catalog** garments, Replication for **new custom** requests. Should be built once and shared between both features rather than duplicated.

### DECIDED (client meeting, 2026-09-25): remove product/uniform spec examples from the customer portal entirely

This changes the design above — not "keep a catalog reference," but **remove it**. Joseph confirmed all real tech pack examples live in a 700-page reference file (shared via WhatsApp, needs review). Decision: **do not show spec/catalog examples on the customer portal at all** — showing examples risks customers requesting full tech packs they're not meant to see directly. So `/portal/products`'s current catalog-embed + example-spec-card content is removed, not kept as reference. The AI tech-pack *generation* flow (customer/rep submits a request → admin produces the tech pack → admin sends it to the client) still stands — the difference is there's no browsable example catalog sitting in the portal beforehand.

**Action item (Work/us)**: review the 700-page tech pack reference file once received, to understand RIVIX's real tech pack format for the reference-guided AI generation approach.
**Action item (Joseph)**: send the file via WhatsApp (referenced as already shared/being shared).
**Received during this session**: one real example page from the reference file (a mining-coverall spec drawing, front/back elevation with measurements and hardware call-outs) — matches the format described above. Useful reference for both the "admin uploads real per-customer technical files" design below and for tuning the AI generation prompt later.

### Reconciled (second session, 2026-09-25, Sayem + Joseph): what replaces the removed example catalog

This session clarified what the page should actually do, refining (not reversing) the removal decision above: the Product Specs page becomes **dynamically managed from the admin panel**, showing **different content per customer** — admin uploads real technical files/drawings specific to that customer's actual contracted products, so each customer sees their own real product breakdown, not a generic browsable example gallery. Combined with the decision directly above: the generic *example* catalog is removed; what's built in its place is a real, per-customer, admin-managed technical-file display — not the same thing as the removed example content, so these two sessions' statements are consistent once read together, not in conflict.

### Correction (2026-09-22): substantial AI analysis groundwork already exists, but is currently broken

`admin/replication/page.tsx` already has a fully built **"AI-Powered Garment Analysis Engine"** UI (4th tab on each ticket) that calls a real, detailed backend route (`/api/analyze-garment`). The prompt in that route is genuinely production-grade — it asks for garment classification, component detection with x/y coordinates, fabric analysis, graded POM measurements (XS–XL), a full bill of materials, seam construction with ISO stitch codes, label placements, colorway, and wash/care instructions. **This is very close to what Joseph described wanting** — the hard part (defining tech pack content/structure) already exists in this prompt.

**Tested live during this session — currently fails, root cause confirmed.** Ran the actual "Run AI Scan" flow with test images and a valid `GEMINI_API_KEY`; it returns `500` / "Failed to process garment analysis." The Network response's `details` field gave the real reason: `{"error":{"code":404,"message":"This model models/gemini-2.5-flash is no longer available..."}}`. The route hardcodes `model: 'gemini-2.5-flash'` in `analyze-garment/route.ts`, and Google has retired that model name — **this is a one-line fix** (swap in a current model name), not a deeper integration problem. The prompt, UI, and overall pipeline are solid; they're just pointed at a deprecated model.

**Scope impact:** this substantially changes the tech pack estimate — likely closer to "diagnose and fix an existing broken feature, then extend it for reference-image-guided generation and the customer/admin delivery workflow" than "build from scratch." Recommend re-estimating this specific item once the actual API error is diagnosed during the fix phase, rather than using the original from-scratch estimate.

## 6. Uniform Replication — current form flagged as inadequate

- Joseph, unprompted, flagged the existing wizard: *"There's an issue in this form... it's not created well according to our need... we have to make it more changes."*
- Wants either:
  - Customer to specify exact requirements (zipper placement, embroidery location, etc.), **or**
  - Admin to type in specs on the customer's behalf
  - Either way, output should generate a tech file/tech pack (ties into #5).
- **Live bug observed during the call**: the shipping-carrier dropdown ("Canada Post" etc.) appeared broken/empty when Joseph asked Peter to click on it live — *"I can't see anything."* Worth reproducing and confirming as a bug.
- **Intended workflow clarified (2026-09-18)**: this is meant to be a conversation routed to a specific person, not a self-service form that just saves data. Flow: customer shares uniform/sample details with **their assigned sales person** → the sales person receives those details → they discuss further (specs, samples, adjustments) with the customer directly. This means the feature's chat/messaging component isn't a nice-to-have — it's core to how the feature is supposed to work, and it depends entirely on the Team/Sales role and customer↔rep assignment existing first (see #1 and #8). Building a working replication form without also building real rep assignment and real messaging would not satisfy the intended workflow.

### Admin/Team UI reuse and visibility model (2026-09-22)

Confirmed while reviewing `/admin/replication` live: the same 4-tab ticket interface (Client Spec Review, AI Garment Analysis, Sample Shipping Dispatch, Client Correspondence Chat) should be **reused as-is for the Team/Sales side**, not rebuilt — just with a different visibility filter layered on top:

- **Sales rep** — sees a Replication Inbox filtered to **only their own assigned clients' tickets**
- **Admin** — sees **everything, unfiltered**, across all reps and clients, and can open and participate in *any* ticket's chat, even ones "owned" by a specific rep — admin oversight isn't blocked by rep assignment
- **Customer** — sees only their own tickets; if admin steps into a conversation that's normally handled by their rep, the customer should see clearly who's actually replying (e.g., labeled "Admin" vs. the rep's real name), not a disguised identity

This is efficient to build: one shared component, three visibility/filter levels layered on top, rather than three separate UIs.

**Clarified 2026-09-24, confirmed by Joseph's order-management answer**: when admin "joins" a conversation, it's a **single shared thread with all three participants visible in it** — not a separate private admin channel. Confirmed by his own phrasing: admin "can join the conversation," and "the assigned rep should always stay copied and involved" — that only makes sense if it's one thread everyone sees, not a side-channel the rep would need to be "copied" into. Requirements this creates: the chat system needs to support more than 2 participants per thread (not just customer↔rep), and every message needs to clearly show who sent it (customer / specific rep name / admin name) so nobody's confused once a third person joins. The rep can never be silently dropped from a thread just because admin stepped in.

### MAJOR CORRECTION (client meeting, 2026-09-25, Sayem + Joseph): Uniform Replication must NOT be customer-accessible at all

This reverses the design above. Sayem (joining this meeting alongside Joseph) was explicit: customers should never have direct access to the Uniform Replication / tech pack creation tool itself — **only Sales Rep and Admin** can create/generate a tech pack. Reason stated directly: to maintain control and avoid misuse — specifically, to prevent a customer taking a generated design/tech pack to a competing manufacturer.

**What this changes:**
- The customer-facing Replication wizard/form described in §6 above (customer specifying zipper placement, embroidery location, etc., or submitting sample requests directly) is **removed entirely as a customer-facing feature**. A customer does not get a "create tech pack" tool.
- **CORRECTED — customer has NO visibility into Replication/tech packs at all**, not even a finished-result view. This is purely an internal Admin ↔ Sales Rep workflow/communication — the tech pack itself is never shown inside the customer portal, in any form, at any stage. (An earlier draft of this note said the customer would see the "finished result" once delivered — that was wrong; there is no customer-facing tech pack view of any kind.)
- The 4-tab ticket interface described under "Admin/Team UI reuse and visibility model" above now applies **only to Sales Rep and Admin** — there is no "Customer" visibility tier for this feature at all; that line is removed from the design.
- **Any tech pack generated by a rep or by admin must upload to the admin portal, regardless of who created it** — so admin always has full visibility, not just the rep who made it.
- The Replication → Order handoff question in §6b is unaffected by this — it's about what happens after a sample is approved, not about who can initiate a tech pack.

**Action item (Work/us):** remove the customer-side Replication design entirely — no creation form, no finished-result view. Replication/tech-pack work happens only inside the Sales Rep and Admin sides of the app.

## 6b. Replication → Order handoff — open question, needs Joseph's confirmation

Raised 2026-09-18: once a replication sample is approved, does it automatically become a real order, or does that stay a manual/separate step?

**Proposed logical flow** (not yet confirmed with Joseph):
1. Customer submits replication request → assigned sales person reviews/discusses
2. Sample gets produced and shipped (matches existing status stages: received → spec mapped → sample production → sample shipped)
3. Customer approves the sample
4. Approval turns into a real bulk order — quantity, pricing, invoice/PO (ties into #4, QuickBooks)
5. Order then appears in the customer's "My Orders" with tracking, and later compliance certificates

**Confirmed true today: these are two entirely separate, disconnected systems.**
- `ReplicationRequest` (`replicationStorage.ts`) has no field referencing an order
- `OrderData` (`storage.ts`) has no field referencing a replication ticket
- No "convert approved sample into an order" workflow exists anywhere
- Since neither system persists to a real database yet (both fall back to local/hardcoded data — see finding 3c), there's nothing to connect even if a link field existed

**Question for Joseph:** should approving a sample automatically create a draft order, or should the handoff stay manual (sales person separately finalizes the order the same way regular orders happen today)? This materially affects how much new work is needed — automatic handoff is a larger build than documenting a manual human bridge between the two steps.

## 7. Shipping / Transit details — carrier options too limited

- Currently appears limited to very few carriers.
- Needs a proper dropdown with **DHL, FedEx, UPS, Canada Post, Purolator** at minimum (matches what we already saw in `getTrackingUrl()` in `replication/page.tsx` — the code already has logic for all 5 carriers, so this may already partially exist; the live bug above suggests the UI/dropdown itself isn't working correctly).
- Wants **tracking codes** so customers can track shipments (air or ocean, depending on route).

## 8. "Your RIVIX Rep" widget — must be dynamic (confirms audit finding directly)

> "I want to make sure that on our team side, let's say if it's Tyler, Tyler would — so all the customers of Tyler would see Tyler's name... I want Pacific to see your RIVIX rep as Tyler."

**This is a direct, explicit confirmation of our audit finding**: the widget must show the actual assigned team member for that customer, not a hardcoded name. Requires:
- A real assignment relationship (customer ↔ team member) in the database — doesn't exist today.
- The widget to read from that relationship instead of hardcoded values.

## 8b. Rep-attributed signup flow — design proposal (2026-09-18)

Raised: should customer account creation live on the sales-person side too, so a rep can invite a lead and have them automatically connected to that same rep? Confirmed yes — this matches the original call: *"the sales executive [does] direct discussion via email or cold calling, then shares a link, [the customer] joins and connects directly with the same SE."*

**Proposed flow:**
- Each rep gets a unique invite link (e.g., `portal.rivix.ca/signup?rep=<token>`) — param name and format still to be finalized (`?ref=` was the placeholder discussed; something like `?rep=` paired with a non-guessable token is preferred, see below).
- **If the link's rep identifier is present and valid**: show a confirmation on the signup page itself — *"You're connecting with Tyler R. — RIVIX Sales"* — so the customer can visually confirm before submitting, and would notice if the link were wrong.

**DECIDED (2026-09-25): no direct/organic self-signup at all.** Earlier drafts of this flow included a fallback for a customer visiting `/signup` with no rep link (blocked pending a "which rep did you speak with" question, or an unassigned-queue option). **Both of those fallbacks are removed.** Confirmed decision: `/signup` is no longer a public page anyone can visit. It only works when reached through a valid rep invite token — no token (or an invalid one) means no working signup form at all, full stop. Every customer account now originates from exactly one of two paths:
1. **A rep's invite link** (this section)
2. **Admin creates the account directly** (§8c addendum below) and assigns a rep

There is no third path, and therefore no "unassigned customer" edge case can ever occur — the open question about handling an organic/no-rep signup is now moot and removed from the meeting-questions list.

**Why not a plain guessable link:** the hiring board references "commission SOPs" for sales reps, meaning rep attribution likely ties to compensation. A plain human-readable param like `?ref=tyler` could be typed manually by anyone to falsely attribute a signup to a given rep. Recommend a unique, non-guessable invite token per rep instead, validated server-side against a real record — not just trusted because it appeared in a URL.

**Admin still needs override capability regardless of how a customer signed up**: reassign a client to a different rep, correct mistaken attribution, or onboard a client directly without any rep link (house accounts).

### Real commission/territory SOP content found — should inform this design (2026-09-22)

`admin/hiring` contains a genuinely detailed, real RIVIX policy document (`HIRING_SOPS` in `hiringStorage.ts`, shown as "SOP 101: Straight Commission Compensation Model" in the UI) that materially changes how rep assignment should work:

- Reps are **100% commission** — no salary, draw, or expenses, ever; 12–15% on closed/collected revenue, 8% residual on renewals for 24 months, accelerator to 18% past $250K/year
- **Account ownership is territory-based**, not just a static customer↔rep link — Alberta is split into 4 named zones (Edmonton/Nisku, Red Deer/Lacombe, Calgary/Cochrane, Fort McMurray/Athabasca) assigned by postal code
- **Ownership expires after 12 months** if no revenue is generated from that account — it reverts to an open pool, not a permanent assignment

**Implication**: the customer↔rep assignment relationship (§8, §8b) needs to support a **territory field and an ownership-expiry mechanism**, not just a simple static "assigned rep" pointer. This is real business logic already documented by the client (even if not yet asked of us directly) — worth confirming with Joseph whether the Team/Sales portal should enforce these rules (auto-revert after 12 months of no revenue, territory-based initial assignment) or if this SOP is aspirational/not yet actively enforced.

**DECIDED (2026-09-25): this SOP content is removed from the admin portal entirely and delivered as a standalone PDF instead.** The "RIVIX Hiring Policies & B2B SOPs" panel (SOP-1 through SOP-4 tabs) inside `/admin/hiring` is not staying in the app — it's internal company policy/reference material, not an in-app feature. It will be produced as a real PDF document for Joseph's team to reference/distribute outside the software. This is a scope reduction for the Sales Hiring rebuild (finding 7o) — one less thing to build/maintain in-app. It doesn't remove the underlying data-model question above (territory field + ownership-expiry logic still needs deciding for the rep-assignment system itself) — only the *display* of the written policy document moves out of the app.

### Resume screening — confirmed intended flow, one real gap found (2026-09-25)

Client described the intended real-world flow in plain terms: post a job → receive resumes → upload them all into the tool along with the job description and what you're looking for → AI analyzes every resume against that and surfaces the best candidates → a human manually reviews and sorts from there. **This confirms what's already built** — `/api/analyze-resume` genuinely exists, scores candidates across 5 dimensions, and produces a shortlist a human reviews/sorts by score, tier, or status (finding 7o). No new feature needed for the core flow.

**One real gap this surfaces**: the tool has **no place to input a job description or "what you're looking for" per posting** — the 5 scoring dimensions (existingRolodex, albertaProximity, industryKnowledge, competitiveIntel, salesMethodology) are hardcoded into the AI prompt for one specific sales-rep-hiring use case, not configurable per job. If RIVIX ever hires for a different kind of role, this tool as built wouldn't adapt. Worth raising with Joseph rather than assuming it needs fixing — may be fine if this tool is only ever used for sales hiring specifically.

### `/admin/team` — confirmed build-from-scratch (2026-09-22)

The current page is a single fake contact-card form (see finding in `03-admin-portal.md` and `06-findings-and-severity.md`) — **zero overlap with what's needed**, this gets fully replaced, not patched. Confirmed design, consolidating §1, §8, §8b, and the SOP findings above into one concrete page:

**Main view — a real rep list** (replacing the single fake card):
- Every sales rep: name, email, phone, status, and count of currently assigned customers
- **"Add New Rep"** — creates a real individual account/login, not a hardcoded field
- Per-rep actions: Edit, Deactivate/Remove, View their customers

**Rep detail view** (clicking into one rep):
- Full profile
- List of every customer assigned to them (same relationship used by Client Directory's Assigned Rep column, §8c below)
- Reassign or remove a customer's assignment
- Territory/zone field, if the SOP-based territory model above gets confirmed as active policy

**Ties into the access model**: this page is where the customer↔rep relationship actually gets established — everything else that depends on it (Client Directory's Assigned Rep column, the rep-attributed signup flow in §8b, the Team portal's filtered "My Clients" view, Replication's rep-scoped inbox) reads from what's set here. Admin retains full override regardless of assignment.

## 8c. Client Directory (`/admin/clients`) — proposed redesign (2026-09-18)

Raised while reviewing the admin panel: this page is currently a flat list with several dead/missing pieces (see [audit-docs/06-findings-and-severity.md](./06-findings-and-severity.md) finding 7k). Proposed full design:

**Client Directory (list view) — additions to the existing table:**
- **New "Assigned Rep" column** — shows the connected rep's name (e.g., "Tyler R.") or a clear **"Unassigned"** badge if none
- Clicking the Assigned Rep cell (or an action in the row menu) opens a picker to **assign, reassign, or remove** the rep connection — admin can override this regardless of how the client originally signed up (ties to #8b, the rep-attributed invite flow)
- **Working search box** — currently not wired to anything (finding 7k)
- **Working "⋮" row menu**, currently dead, with actions: Edit, Assign/Reassign Rep, Deactivate, Resend Portal Invite
- **Status change capability** — move a client between "Pending Audit" and "Verified" from this view

**Client Detail page (new — doesn't exist today):**
- Clicking a client's name opens a dedicated profile page showing:
  - Full contact info, editable
  - Assigned rep, with reassign option
  - Order history for that client
  - Replication tickets for that client
  - Compliance certificates for that client
  - An activity/notes section (internal notes admin/reps can leave about the account)

### "Add New Client" flow — concrete definition (2026-09-22)

Defines what the currently-dead "Add New Client" button (Finding 7k/7n) should actually do — admin-driven account creation, combined with rep assignment in one flow:

1. **Admin fills in the new client's details** — company name, contact name, email, location
2. **Admin assigns a sales rep to them right there**, as part of the same creation step — not a separate action afterward
3. **System creates the real account and sends a welcome email** to the client's address, with either a temporary password or a "set your password" link
4. **Client logs in for the first time using that credential**, and can change their password afterward via the profile/account settings page (ties to Finding #3b — this also requires that missing profile page to exist)

This is a **third path into the system**, alongside self-signup (§1) and the rep-attributed invite link (§8b) — for cases where admin/sales directly onboards a client (e.g., over the phone) rather than the client signing themselves up. All three paths should converge on the same real account + rep-assignment data model.

This is a genuinely new page and set of interactions — not a fix to something partially built, since no `/admin/clients/[id]` route or equivalent exists anywhere in the codebase.

## 8d. Order Management (`/admin/orders`) — proposed redesign + open business question (2026-09-22)

**Confirmed technical state**: `Manual Order Entry` button has no `onClick` (dead), search box isn't wired to anything, and `Generate Certs` doesn't generate anything real — it's a 2-second fake loading spinner that just flips the label to "Live in Portal." All 3 orders shown are hardcoded, matching the pattern everywhere else in admin.

**Proposed order lifecycle** (design decision, ours to make — not asked of Joseph):
1. Order entered (manually here, or synced from QuickBooks once #4 is built)
2. Order moves through production stages (matches RIVIX's real 4-stage process — see #0)
3. `Generate Certs` triggers the real certificate upload workflow (#3) once the factory delivers
4. Order flips to "Live in Portal" — visible in the correct customer's `/portal/orders` and `/portal/certificates`, which depends on the tenant-scoping fix (Finding #3) actually working
5. Same "Assigned Rep" column/filter as the Client Directory redesign (#8c) — a design decision we make ourselves, not something to ask Joseph about

**ANSWERED by Joseph (2026-09-24)** — full operational split confirmed:

1. **Rep creates the order** for their customer, responsible for complete initial info: products, quantities, sizing, branding, delivery location, pricing, PO, special requirements.
2. **Admin owns everything operational after submission** — not just oversight. Specifically: supplier communication, order confirmation, artwork/sample approvals, certifications/compliance documents, production status, inspection/QC, shipping/tracking, order status updates, delivery confirmation, and any internal issues with factories, freight, or documentation. **The rep should never have to chase factories, freight companies, certificates, or production updates themselves.**
3. **Rep keeps full read visibility** into order status, documents, certifications, tracking, notes, and updates throughout — informed at every stage, but not doing the operational work.
4. **Customer communication stays with the rep by default.** Admin manages everything behind the scenes and updates the order in the portal; the rep relays those updates to the customer. Admin only joins the conversation directly for serious issues — technical, compliance, payment — and **the assigned rep must always stay copied/included**, never bypassed.

**One-line summary**: Rep = sell, submit the order, manage the customer relationship, follow the order through the portal. Admin = manage everything operational from submission through delivery. **The rep should never become an order coordinator** — their job stays selling and taking care of the customer.

**Confirmed permission model**:
- **Rep can**: create new orders for their own customers, view full status/documents/certs/tracking/notes for their own orders (read access to operational data), communicate with their own customers
- **Rep cannot**: edit operational fields (production status, shipping, certs, supplier communication) — that's admin's job
- **Admin can**: see and actively manage every order across every rep — update statuses, documents, certifications, shipping, notes, and handle exceptions
- **Admin joining a customer conversation**: only for serious/technical/compliance/payment issues, and the rep stays copied/included always, not removed from the thread

This directly refines the Sales Rep recommendation ([13-sales-rep-recommendation.md](./13-sales-rep-recommendation.md)) — order creation is a **rep-side action**, not admin/CSV-only as earlier drafts assumed.

**Follow-up question — ANSWERED (2026-09-25)**: **"Manual Order Entry" is removed entirely, not rebuilt.** Admin does not create orders directly. Confirmed decision:
- **The rep still creates the initial order/spec request** in the portal (products, quantities, sizing, branding, delivery, pricing, special requirements) — this stands from Joseph's 2026-09-24 answer.
- **The formal invoice and Purchase Order are never created manually in the app, by anyone.** They come exclusively from **QuickBooks**, synced into the portal for **display only**.
- **How the two connect**: rep submits the order request → admin processes it operationally (per the confirmed model above), which includes issuing the real invoice/PO in QuickBooks → that invoice/PO syncs back into the portal, where the customer (and rep, and admin) can see it.
- **QuickBooks integration scope is now more specific than originally drafted in Requirement #4**: the portal must show **every order's invoice and Purchase Order**, sourced from QuickBooks, per customer. Not just generic "order history" — specifically the real financial documents.
- The Admin Orders page (`/admin/orders`) changes accordingly: no "Manual Order Entry" button at all; it becomes a management/monitoring view over orders that originated as rep requests and now have (or are waiting on) a real QuickBooks invoice/PO.

## 8e. Product Catalog (`/admin/products`) — static PDF, open question for Joseph (2026-09-22)

**Confirmed technical state**: this page is just an embedded viewer for a static PDF (`productCatalog.ts:2` hardcodes `/pdf/RIVIX-Apparel-Manufacturing-Catalog.pdf`) — identical to what the customer sees on `/portal/products`. No product database, no add/edit/remove, nothing to manage. Not broken, just very simple — not a fix item.

**Open question for Joseph**: *"The product catalog PDF is currently a fixed file that requires a developer to update and redeploy. Would you like the ability to upload a new version yourself from the admin panel, so catalog updates don't need a developer each time?"*

If yes, this is a small, well-scoped addition (likely Supabase Storage-backed upload + replace), not a rebuild.

## 8f. CSV/Batch Import (`/admin/import`) — real-world workflow question for Joseph (2026-09-22)

**Confirmed technical issue**: silent fake-data substitution on mismatched or blank rows, live-confirmed twice (see [06-findings-and-severity.md](./06-findings-and-severity.md) finding 7p, High severity).

**Open question for Joseph**: this tool's fields (`batch_number`, `material`, `safety_standard`, `inspector_name`, `origin`) look like production/manufacturing batch-tracking data, not commercial order data (no price, no PO number) — separate from the phone/email → QuickBooks order flow already described in §4. *"Do you currently track production batches in an Excel sheet (materials, QC inspector, safety certs)? If so, could you send us a real sample so we design the import to match your actual columns, instead of guessed field names?"*

**Proposed fix, two options** (recommend presenting both to Joseph):
1. **Strict template + validation** — fixed required column names (like the existing `rivix_import_template.csv`), with the file rejected/clearly flagged if columns don't match, instead of today's silent fallback to fake data. Quick fix, but requires reformatting to our template every time.
2. **Real column-mapping step** (recommended) — after upload, admin manually maps their actual spreadsheet columns to our fields (e.g., "Fabric" → "Material"), confirmed visually before import runs. Matches whatever format RIVIX's real sheet already uses, no reformatting needed, and directly prevents the silent-substitution bug. More work to build than option 1, but more resilient.

**Also confirms every order needs a real customer link, not a name field** (ties to Finding #3 and the Client Directory redesign, §8c) — whichever fix direction, the import needs to link each order to an actual customer account ID, not just a free-text name, or the same tenant-scoping problem repeats here.

**Next step**: share our test sheets (`test-import-correct.csv`, `test-import-mismatched-columns.csv`) with Joseph if there's any confusion explaining the bug, and request his real production tracking sheet to design the mapping properly.

## 8g. Current system & data migration — open question for Joseph (2026-09-22)

Not yet asked: what RIVIX actually uses today to manage customers/orders, and whether existing data should be migrated into the new portal at launch.

**Draft question for Joseph:**
1. *What are you using right now to manage customers and orders — just Excel/spreadsheets, QuickBooks alone, another CRM, or a mix?*
2. *At launch, do you want a one-time bulk import of your existing customer list and order history so everything's in the system from day one, or start fresh and only add new orders going forward?*
3. *If importing historical data — roughly how many customers/orders, so we can scope the cleanup/validation needed?*
4. *Is there a target go-live date, or would the new portal run in parallel with your current process for a while before fully switching over?*

**Why this matters for scope**: the answer determines whether "launch" includes a one-time historical data migration (potentially significant additional work depending on volume and how clean the source data is) or just a clean start — this should be resolved before finalizing the hours estimate and timeline.

## 8h. Notifications — confirmed fake, design + email question for Joseph (2026-09-22)

**Confirmed technical state** (`NotificationBell.tsx`): entirely hardcoded — 2 fixed notifications for admin, 2 for client, no real events, no persistence. The "RIVIX Real-Time" label is false. Unread count resets to 0 on open and never updates again. "Clear all notifications" doesn't clear anything — it's just a link to the replication page. (One of the hardcoded admin notifications references "Sarah Jenkins" — the same orphaned test persona from the dead Transcript tab in Hiring, finding 7-transcript.)

**Proposed real design**: notifications driven by real events (order status change, replication submitted, sample dispatched, certificate ready, hiring events), with real persisted read/unread state and a working clear/mark-as-read action.

**Open question for Joseph**: *"For notifications, do you want these to also send an email automatically, or should people just check the in-app bell manually? Should this differ per event type (e.g., always email for 'sample ready to ship,' but just in-app for less urgent things)?"*

## 8i. Internal admin↔sales-rep messaging — open question for Joseph (2026-09-22)

Distinct from the customer-facing chat design (§6 addendum, where admin can join a customer/rep conversation) — this would be a **separate internal channel** for admin to message a specific rep about a specific order/customer, without the customer seeing it.

**Open question for Joseph**: *"Do you want a way for admin to directly message a sales rep about a specific order/customer internally — separate from the customer-facing chat — for internal coordination? Or is that better handled outside the app (Slack, phone, etc.), in which case we don't need to build this?"*

## 8j. Admin profile page and admin role tiers (2026-09-22)

**Profile page — confirmed needed, not optional**: since admin is moving to real individual ID/password logins (replacing the shared PIN, Finding #4 fix direction), each admin needs a profile page to view their own account info and change their password — same underlying gap already documented for customers (Finding #3b) and the admin header's dead avatar (Finding #7m).

**Admin roles/tiers — needs Joseph's input, two options:**
1. **Flat** — all admins are equal; anyone with admin access can create/manage other admin accounts
2. **Tiered** — a "Super Admin" role (likely Joseph) controls who else gets admin access; other admins (Peter, Sayem, future hires) have full daily functionality but can't add/remove other admins themselves

**Draft question for Joseph**: *"For admin accounts — should everyone with admin access be equal, or should there be a 'Super Admin' level (probably you) who controls who else gets admin access, while other admins have full daily functionality but can't manage admin accounts themselves?"*

This affects how the login/account system should be built from the start rather than retrofitted later.

## 9. Scope sequencing

- Joseph wants to **focus on one portal at a time**: fix/complete one (implied: likely admin or customer first), then move to the next.
- Confirmed 3 portals ultimately needed: **Admin**, **Customer**, **Team** (employee) — each with different access levels.

## 9b. MVP-first scoping + progress status (client meeting, 2026-09-25, second session)

- **MVP-first confirmed**: keep the initial launch scope limited so the portal can go live sooner, with further improvements layered on after — rather than trying to ship every discussed feature in one go. Consistent with the existing "one portal at a time" sequencing in §9, but stated as an explicit build philosophy, not just an ordering choice.
- **Stated completion figure**: Work told Joseph/Sayem the customer portal is roughly **10-15% complete**. Worth reconciling with our own estimates elsewhere in the audit docs (e.g. `10-role-based-summary.md`, `12-page-by-page-breakdown.md`), which generally describe individual pages as "70-80% of the UI, little to none of the real backend/security" — the 10-15% figure is a rougher, more conservative whole-portal number (weighting real working functionality low, since most pages are static/UI-only with no live backend). Not a contradiction, just a different level of granularity — flagging so the same number gets used consistently in future client-facing materials.
- **Action item (Work/us)**: provide a demo of the customer portal to Joseph/Sayem's team for feedback before proceeding with further improvements.
- **Action item (Work/us)**: train/tune the AI tech-pack feature on Joseph's real tech pack examples once the reference file is reviewed (ties to §5's action items above).
- **Onboarding reconfirmed**: sales reps cold-call prospective customers, then share a sign-up link. This matches (not replaces) the rep-invite-link design already proposed in §8b — the link-based signup mechanism stands as designed.

## 11. Data dependency chain (2026-09-22) — what must exist before what

Raised while discussing Import CSV: nothing in this system works in isolation — each piece depends on the one before it existing as a **real linked record**, not a name/string match:

1. **Customer/Client account** must exist first (real record via Client Directory) — nothing can attach to a customer that doesn't exist
2. **Sales rep gets connected** to that customer (via the Team/Rep assignment system, §8/§8b) — establishes ownership
3. **Order gets created**, linked to that customer's real ID — not a free-text name (ties to Finding #3, the core tenant-scoping issue running through the whole app)
4. **Production/batch data** attaches to that order (materials, QC, safety — via Import CSV or manual entry, §8f)
5. **Certificates** generate/upload against that specific order (§3)
6. **The assigned rep sees this chain** in their filtered view; **admin sees it unfiltered**

If any single link in this chain is a free-text/hardcoded match instead of a real relationship, everything downstream breaks — this is the same root cause behind nearly every High/Critical finding in this audit. Worth stating explicitly to Joseph: fixing this chain end-to-end (not just individual pages) is the actual core of the technical work, more than any single feature.

## 12. Testing & verification requirement (2026-09-22) — not yet built into the estimate

Explicitly flagged: build/fix hours alone are not the whole picture. Once features are built or fixed, they need **real, hands-on testing with real connected data** before being considered done — not just "the code looks right."

**What "properly tested" means here**, based on how this audit itself was conducted (live-testing over code-reading alone, e.g. the CSV import bugs and AI model bugs found only by actually running them):
- Create a real customer → assign a real rep → place a real order → attach real production data → generate/upload a real certificate → confirm it displays correctly **only** to the correct customer and their assigned rep, and **not** to anyone else
- Repeat for edge cases: no rep assigned, multiple orders per customer, a rep with multiple clients, admin overriding a rep's ticket

**Also applies to things that appear to "already work"**: several features in the current codebase have real, correctly-wired logic that we have **not personally live-tested end-to-end** (e.g., the Cal.com booking link generation in Hiring, whether the correspondence email actually sends once `RESEND_API_KEY` is configured, whether `saveCandidate`'s merge-by-name-or-email logic behaves correctly with real data volume). These should not be assumed to work just because the code reads correctly — they need the same live-testing treatment as everything else found broken in this audit, flagged as **"appears correct in code, not yet live-verified"** rather than either "working" or "broken."

**Scope/estimate impact**: testing (and the fixing that follows from what testing finds) needs its own dedicated time allocation in the final estimate — separate from initial build/fix hours — rather than being assumed to happen for free within the build estimate. Recommend adding a distinct "Testing & QA" line item once the full scope is finalized.

## 10. Process notes
- No written spec exists — this document (and the full call recording) is the closest thing to one.
- Follow-up communication channel: WhatsApp group with Joseph, Peter, and Sayem (phone numbers to be shared directly in chat, not on the call platform, due to that platform's ToS).
- Joseph asked about **lead time** for this build — still an open question to answer once scope is finalized.

---

## Visual reference

Flow and relationship diagrams covering the current state of each role, and how they should connect, are in [diagrams/](./diagrams/):
- [01-customer-portal-flow.svg](./diagrams/01-customer-portal-flow.svg) — customer pages and which ones use hardcoded/mis-scoped data
- [02-admin-portal-flow.svg](./diagrams/02-admin-portal-flow.svg) — admin pages, including the non-functional Team page and missing-table issues
- [03-team-role-flow.svg](./diagrams/03-team-role-flow.svg) — proposed Team/rep dashboard (none of this exists yet)
- [04-role-relationship-map.svg](./diagrams/04-role-relationship-map.svg) — how Admin, Team, and Customer should connect vs. how they connect today (only Admin→Customer visibility currently exists)

## Cross-reference: how this changes the engagement

This call reveals the engagement is **broader than a security/bug audit** — Joseph is describing missing features and a role model that was never finished, not just asking us to find bugs in a complete system. Recommend restructuring the conversation with Joseph around two tracks:

1. **Audit findings** (see [06-findings-and-severity.md](./06-findings-and-severity.md)) — security/data issues in what exists today (auth gaps, hardcoded tenant data, the `rep_client_chats` exposure, shared admin PIN).
2. **Feature build-out** (this document) — the Team/Sales role, dynamic dashboards, cert upload workflow, QuickBooks integration, AI tech pack generation, replication form rework, carrier dropdown fix, rep assignment logic.

These need separate scoping and likely separate estimates — track 1 is audit/remediation hours, track 2 is new feature development. Worth clarifying with Joseph which track he wants prioritized, and revising the original hourly estimate accordingly since track 2 (QuickBooks integration, AI image generation, three full role-based portals) is substantially larger than the original ~20-hour audit estimate.
