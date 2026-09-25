---
title: Customer Portal — Page by Page
---

# Customer Portal (`/portal/**`) — What Each Page Means

## 1. Dashboard / Overview (`/portal`)
Landing page after login. Welcome banner with the client's org name, a summary line ("You have X active records"), stat cards (Total Orders, Compliance Certificates), and a preview table of the 5 most recent orders, with a link into full order history.

**Status:** org name and sample orders are hardcoded; see [06-findings-and-severity.md](./06-findings-and-severity.md#3-no-tenantcustomer-scoping-on-data).

## 2. My Orders (`/portal/orders`)
Full, searchable order history — batch number, product spec, quantity, links into each order's detail page.

**Status:** same hardcoded-filter pattern as the dashboard.

## 3. Order Detail (`/portal/orders/[id]`)
Drill-down for a single order: order date, quantity, origin, technical specs, a garment blueprint image, and associated compliance certificates (Certificate of Origin, Quality Inspection Report, Certificate of Compliance), each viewable/downloadable as PDF.

**Status:** falls back to a hardcoded demo order for any unmatched ID.

## 4. Product Specs (`/portal/products`)
Reference catalog — embeds a product catalog viewer plus technical specs for approved garments under contract (fabric, reinforcements, hardware, construction notes).

**Status:** the one clean page — static catalog data, no client-specific filtering, not affected by the tenant-scoping issue.

## 5. Compliance Certs (`/portal/certificates`)
Aggregated library of all compliance documents across all the client's orders/batches, viewable/downloadable as PDF.

**Status:** same hardcoded-filter pattern.

## 6. Uniform Replication (`/portal/replication`)
The most complex customer feature — request RIVIX to "reverse engineer" an existing garment: upload photos (front/back/tag/detail), specify garment type, optionally send a physical sample via courier, track progress through stages (received → spec mapped → sample production → sample shipped), and chat with the RIVIX team about the request.

**Status:** this page *attempts* to write to a Supabase `replications` table, but that table doesn't exist — submissions silently fall back to that browser's `localStorage` instead (confirmed via direct testing: tickets created here are not visible anywhere else, not even in the admin panel). The code also hardcodes every submission's `clientName` as `'Pacific Mining Co.'` and sender name as `'Gary Vance'` regardless of who submits it — a design flaw that's currently dormant (no real database to corrupt) but would activate the moment the table is created. See finding #3 in [06-findings-and-severity.md](./06-findings-and-severity.md).

## "Your RIVIX Rep" widget
Shown on the dashboard sidebar — meant to represent the customer's assigned account manager/sales rep, with contact info and a "Schedule a Call" link.

**Status: not a real feature.** Fully hardcoded to "Sayem R." / `sayem@rivix.ca` / `(403) 555-1234` for every customer. There is no admin-assignment mechanism, no automatic assignment logic, and no way for a sales exec's invite link to connect a customer to a specific rep. See [01-roles-and-auth.md](./01-roles-and-auth.md#sales-rep-assignment--not-built).

## What's missing entirely
- **No profile/account settings page** — a customer cannot view their own account details or change their password anywhere in the portal.
- **No visible indication of who's actually logged in** beyond the hardcoded org name badge in the header.
