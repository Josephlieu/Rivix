---
title: Role-Based Master Summary
---

# RIVIX — Role-Based Summary

A plain-language look at where things stand for each of the three roles: Admin, Sales Rep, and Customer. Technical detail and proof for every item mentioned here lives in the findings and requirements docs, if needed.

---

# ADMIN

**How complete is our review?** Fully done — we went through every admin page and tested things live, not just read the code.

## What's wrong today (needs fixing, not rebuilding)
- Admin login is a single shared code everyone uses — no individual accounts, and even "signing out" doesn't fully log you out
- The main dashboard shows fake numbers, not real ones
- The client list shown in admin is test data, not real customers (confirmed with you already)
- Uniform replication requests are only saved on one person's computer — they don't reach a shared system
- The Orders page has buttons that don't do anything, including one that's supposed to generate certificates
- The "Team & Rep Management" page doesn't actually manage anyone — it's a placeholder
- The hiring tool has real people's personal information stored in a way it shouldn't be, and its AI resume-scanning feature is broken (we found the exact cause)
- **Bulk-importing data (CSV upload) can silently save the wrong information with no warning** — this is the most serious admin-side bug we found
- The notification bell shows fake, hardcoded alerts, not real ones
- A couple of smaller display bugs and missing pages (no way for admin to manage their own account/password)

## What needs to be built new
- Real individual admin logins, replacing the shared code
- A real Team & Rep management system — add/remove sales reps, assign them to customers
- A proper client management page with the ability to add real client accounts and connect them to a sales rep
- A working way to manage orders and generate real certificates
- A better way to bulk-import spreadsheet data safely
- A real notifications system
- A simple account page for admins

## Still to check
- Confirm the resume-scanning fix actually works once applied
- Double-check for any other places with the same kind of AI bug
- A closer look at outdated software components flagged as security risks

## Rough experience issues
- Many things fail silently — no error message shows up, it just doesn't work, with no explanation
- A few places claim things are "live" or "real-time" when they aren't

---

# SALES REP

**How complete is our review?** Nothing to review — this role doesn't exist in the app yet at all, confirmed by you as something that needs to be built from the ground up.

## What needs to be built (all of it)
- Individual logins for each sales rep (~10 people)
- A real way to connect a specific customer to a specific rep
- A way for a rep to invite a new customer and automatically be connected to them
- A full dashboard for reps: their customers, their orders, certificate requests, replication tickets, and messaging
- A working chat system between reps and their customers

## Still to check
- We found a real commission/territory policy document already in your system — worth confirming with you whether that should actually be enforced by the app, or if it's just reference material

---

# CUSTOMER

**How complete is our review?** Fully done, except one bug you reported (logging out "glitches" the site) that we haven't been able to reproduce yet — we'll need a bit more detail from you on what exactly happens.

## What's wrong today (needs fixing, not rebuilding)
- The customer portal can be viewed without logging in at all
- Customer data isn't kept separate — the system doesn't properly check who's logged in before showing information
- A real, live database is exposing customer emails and messages publicly, with no login needed — this is the most serious issue found in the entire audit
- No way for a customer to manage their own account or password
- The "your rep" contact card shown to customers is fake — same info for everyone
- The uniform replication feature doesn't save anywhere real, and its built-in chat isn't connected to an actual person
- A few smaller issues: no way to see your password while typing it, unbranded emails, a generic error page

## What needs to be built new
- A real way for customers to request and receive compliance certificates
- A connection to QuickBooks so customers can see their real order history (view-only, not for payments)
- Finishing the AI tech-pack feature (good news: most of it already exists and works — we found and fixed the bug blocking it)
- A properly working uniform replication feature, connected to a real sales rep
- A simple account/profile page

## Still to check
- The logout issue you reported — need more detail before we can pin it down
- Confirm the "forgot password" flow works as expected

## Rough experience issues
- Same pattern as admin — some things fail with no explanation
- Customers have no way to tell whose account information they're even looking at, since there's no account page

---

# Where things stand overall

Admin and Customer both have real, working foundations underneath — they need genuine repair, not a rebuild. Sales Rep is a clean slate. The single biggest unknown right now is the logout bug, which we need more detail on before we can properly size it.
