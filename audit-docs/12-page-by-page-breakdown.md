---
title: Page-by-Page Breakdown
---

# Page-by-Page Breakdown

For every page we've reviewed, three quick checks:
- **UI**: is the visual design/layout actually built correctly?
- **Data**: is what's shown real, or dummy/hardcoded?
- **Logic**: does the real functionality behind it exist, or does it need to be built?

Plus what's worth discussing with Joseph before building anything.

---

# ADMIN PAGES

## Dashboard (main admin page)
- **UI**: partly unfinished — the stat cards and layout are built properly, but the chart area visibly shows the word "Placeholder" right on the screen, so it doesn't actually look finished
- **Data**: dummy — the numbers shown aren't real counts, some are made-up formulas
- **Logic**: mostly missing — there's no real system counting real things yet
- **The "chart" is a placeholder** — just an icon and the words "Order Velocity Chart (Placeholder)." No actual chart was ever built.
- **"Recent Activity" is partly real, partly fake** — if orders exist, it lists the last 5, but every single one says "Just now" regardless of when it actually happened, since there's no real timestamp being used. "View All" doesn't go anywhere.
- **What it should actually do**: show real events as they happen across the business — new orders, replication requests, certificate requests, shipped samples, new signups — each with who it involves and a real time (like "2 hours ago"), pulled from one shared activity log everything else feeds into. "View All" should open a full, searchable history.
- **Discuss with client**: which of these event types matter most to see at a glance? Any others to include (e.g., new sales rep signups)?

## Client Directory
- **UI**: looks about 80-85% done — layout and structure are there, but hasn't been stress-tested for edge cases
- **Data**: dummy — confirmed test data, not real clients
- **Logic**: missing — no real "add client," search, or menu actions work
- **Discuss with client**: confirmed already — needs a real add-client flow, and a way to see which sales rep is connected to each client

## Uniform Replication (admin side)
- **UI**: roughly 70-80% — quite detailed (4 different sections per request), but we can't call it "correct" without a full pass; real usage will likely turn up modifications and small bugs, the same way we found real bugs on the customer-facing version of this same feature
- **Data**: we filled in test data ourselves to see it working — normally empty
- **Logic**: partially real — the AI photo-analysis feature is genuinely functional (we found and can fix its one bug), but saving/chatting only works on one person's computer, not shared
- **Discuss with client**: confirmed the AI tech-pack idea; still need his real example files, and a decision on the review-before-sending-to-customer workflow

## Orders
- **UI**: roughly 80% — layout looks complete, not fully stress-tested
- **Data**: dummy
- **Logic**: missing — none of the buttons (add order, generate certificates) actually do anything
- **Discuss with client**: who's responsible for orders day-to-day, admin or the sales rep? (question sent separately)

## Products
- **UI**: roughly 90% for what it currently is — but it's a very simple page (just a PDF viewer), so there's not much to get wrong
- **Data**: real (it's your actual catalog PDF)
- **Logic**: not needed for what it currently does; would need building only if you want to upload new catalog versions yourself
- **Discuss with client**: do you want to be able to update the catalog yourself, without needing a developer?

## Team & Rep Management
- **UI**: built, but very minimal (just one form)
- **Data**: dummy — and worth noting, doesn't even match what's shown elsewhere in the app
- **Logic**: completely missing — nothing saves, and it's not a real "manage my team" tool at all
- **Discuss with client**: already confirmed — needs to become a real add/manage sales reps tool

## Sales Hiring
- **UI**: roughly 75-80% — genuinely detailed (resume viewer, scoring tool, scheduling, messaging), but we already found a dead tab and mismatched fake reps referencing a nonexistent candidate, so it hasn't held up to full scrutiny either
- **Data**: a mix — some real candidate information stored the wrong way, some clearly fake test data
- **Logic**: partially real — resume-scanning AI exists but is broken (found the cause), messaging is genuinely real and just needs one setting turned on, but a couple of features (interview questions, a "transcript" tab) look AI-powered but are actually just fixed text
- **Discuss with client**: is this hiring tool meant to connect to your real job application page, or stay separate?

## Import CSV
- **UI**: roughly 80% — looks like a proper multi-step wizard, but we already proved it can display wrong information without warning, so "looks fine" clearly isn't the same as "is fine"
- **Data**: dummy by default; we tested it with our own files
- **Logic**: real, but with a serious bug — it can silently save wrong information if your spreadsheet's column names don't match exactly what it expects
- **Discuss with client**: what spreadsheet are you actually using today, so we build the import around your real format?

---

# CUSTOMER PAGES

## Dashboard (portal home)
- **UI**: roughly 85% — layout looks complete, not fully stress-tested
- **Data**: dummy — same welcome message and order info shown to every customer
- **Logic**: missing — nothing checks who's actually logged in before showing this
- **Discuss with client**: already covered by the general "each customer should see only their own info" fix

## My Orders / Order Detail
- **UI**: roughly 85% — looks complete, not fully stress-tested
- **Data**: dummy
- **Logic**: missing — same underlying issue as the dashboard
- **Discuss with client**: none needed beyond the general fix

## Product Specs
- **UI**: roughly 85% — looks complete, not fully stress-tested
- **Data**: mostly real (the catalog), one hardcoded example spec sheet
- **Logic**: fine as-is for browsing; the "tech pack" generation part is a new feature, not a fix
- **Discuss with client**: already covered under the tech pack discussion

## Compliance Certificates
- **UI**: roughly 85% — looks complete, not fully stress-tested
- **Data**: dummy
- **Logic**: missing — no real certificate storage or per-customer filtering exists yet
- **Discuss with client**: already designed a request/upload flow — needs his sign-off

## Uniform Replication (customer side)
- **UI**: roughly 70-75% — quite polished, but this is the page where we actually found real bugs (a stale ticket showing after starting a new request, chat not auto-scrolling) — proof that "looks polished" isn't the same as "works correctly"
- **Data**: dummy until we added test data ourselves
- **Logic**: partially real — submitting a request and chatting both technically work, but only save to your own browser, and the chat replies are scripted, not from a real person
- **Discuss with client**: already covered — needs a real sales rep connected to make this actually useful

---

# What this tells us overall
Almost every page follows the same pattern: **the visual design is done well, but the real data and real working logic behind it are missing.** This is genuinely good news — it means we're not redesigning pages from scratch, we're connecting already-good designs to a real, working system underneath. The two real exceptions are the Sales Hiring resume-scanner (has a specific bug to fix) and the CSV Import tool (has a data-safety bug to fix) — both need direct attention, not just "connect to a database."
