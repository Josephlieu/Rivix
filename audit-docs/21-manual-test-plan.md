# 21 — Full manual test: end to end, plus a gap and consistency review

Run this from zero on the **dev** app (`npm run dev`, http://localhost:10001). Use three **private windows** so logins don't mix: **A** = admin, **B** = rep, **C** = customer. Tick each box; write the result in the table at the end. For anything wrong **or just inconsistent**, take a screenshot and note the step number.

Test accounts (dev only): admin = your admin login. Create a **new rep** and a **new client** in Part 1 (this also tests the welcome messages). Use small PDF / image / Word files for uploads.

## Part 1 — Admin sets up the people (window A)
- [ ] 1.1 Sign in at `/admin-login`; the Dashboard opens.
- [ ] 1.2 **Team / Reps → Add Rep** (name, title, email, phone, "Also create a login"). A credentials card shows email + password. Copy / WhatsApp / Email buttons work.
- [ ] 1.3 The rep is listed as Active, "Has login", with a code `REP-xxxx`.
- [ ] 1.4 Try editing the rep: the **email is greyed out** (it is their login).
- [ ] 1.5 **Clients → Add New Client** (popup): company, login email, phone, pick the new rep. Credentials card shows; client listed with `CUS-xxxx`, the right rep, Active, 0 orders.
- [ ] 1.6 Change the client's rep to another rep and back (dropdown in the list). No error.

## Part 2 — Rep creates an order (window B)
- [ ] 2.1 Sign in at `/login` as the new rep: lands on the Sales Portal. **Bell shows 1 unread** (welcome) and the customer assignment message.
- [ ] 2.2 **My Customers** lists only your client; the client page opens (no orders yet).
- [ ] 2.3 **New order**: pick the client; product with the **size grid** (M 10, L 25); add **Custom size** "One size" 5; add a second product; fill delivery, PO, pricing, requirements. Total updates as you type.
- [ ] 2.4 Submit → order page with an `ORD-` number, stage **Order Received**, size tags.
- [ ] 2.5 Back on the Overview: stats/recent orders show the new order. **Orders** list: search and stage filter work.

## Part 3 — Admin processes the order (window A)
- [ ] 3.1 **Bell**: "New order ORD-…". Click → opens that order. Number drops.
- [ ] 3.2 **Orders** list shows it (customer, rep, product, stage); search, rep filter and stage chips work.
- [ ] 3.3 Order page: details, products with sizes, timeline, documents box, "Update stage" greyed out.
- [ ] 3.4 Change the stage to **In Production** with a note → "Saved.", badge changes, timeline shows it with your email.
- [ ] 3.5 **Shipping**: pick a carrier from the dropdown, enter tracking, save. Save is greyed until something changes.
- [ ] 3.6 Add a note **Customer can see** and one **Internal only**.
- [ ] 3.7 Move to **Shipped**, later to **Delivered** (confirmation dialog) and to **Cancelled** (confirmation); a cancelled order can be moved back.

## Part 4 — Customer sees it (window C)
- [ ] 4.1 Sign in at `/login` as the client: lands on the Client Portal; sidebar shows the rep; Overview numbers are real.
- [ ] 4.2 **Bell**: welcome, "Order … was created for you", stage change, visible note. Each opens the customer's own order page.
- [ ] 4.3 **My Orders**: columns order date, PO number, stage (+ truck icon when tracking exists); search finds a PO number.
- [ ] 4.4 Order page: heading, products with sizes, shipping, progress timeline.
- [ ] 4.5 **The internal note appears nowhere** (bell, timeline, anywhere).

## Part 5 — Documents and the viewer
- [ ] 5.1 (A) Order page → Documents: choose a type, a PDF, **Upload**. It appears in the list.
- [ ] 5.2 **View** opens the viewer on the same page: PDF pages visible; close with X / Escape / outside click.
- [ ] 5.3 Upload a **Word (.docx)** and an **image**: both preview. An **Excel** file says it can't be previewed and offers Download.
- [ ] 5.4 **Download** saves the file under its original name and shows a toast; the page stays put.
- [ ] 5.5 (C) The document shows on the order page and on **Compliance Certs** (grouped by month, search works); View and Download work. Overview "Documents" count is right.
- [ ] 5.6 (B) The rep sees the document on the rep order page and can View / Download but not delete.
- [ ] 5.7 (A) Delete a document (confirmation) → gone for everyone.

## Part 6 — Notifications (check each, in the right window)
- [ ] 6.1 Rep creates order → **admin** told; **customer** told; rep not told.
- [ ] 6.2 Stage change → **customer** and **rep** told with a working link; same stage again → nothing.
- [ ] 6.3 Visible note → customer told; internal note → nobody.
- [ ] 6.4 Document uploaded → **customer** and **rep** told.
- [ ] 6.5 Assign / change a client's rep → new rep, old rep and the customer are told.
- [ ] 6.6 Bell: red number matches unread count; **per-item check button** marks one read without opening; **Mark all read**; **View all notifications** opens the page (All / Unread tabs, Load more).

## Part 7 — Document requests
- [ ] 7.1 (B) On the order: **Request document** (Test Report + note) → "Request sent". (A) bell "Rock requested a document", yellow "Requested by the rep" box.
- [ ] 7.2 (A) Upload a Test Report → request closes by itself; (B) told "fulfilled"; shows Done.
- [ ] 7.3 (B) Send another (CSA Certificate); (A) **Mark done** → (B) told "handled".
- [ ] 7.4 (C) While the order is **before Shipped**: only the note "You can request… once your order has shipped", no button. Move it to **Shipped** (A); reload (C): the **Request a document** button appears.
- [ ] 7.5 (C) Request a document → "Request sent to your sales rep", list shows "With your rep". (B) told; request marked "from customer" with **Send to admin** / **Dismiss**. (A) **not** told yet.
- [ ] 7.6 (B) **Send to admin** → (A) told + yellow box; (C) told "being handled", list shows "With RIVIX".
- [ ] 7.7 (C) Ask for another type; (B) **Dismiss** → (C) told it was closed; (C) can ask again.
- [ ] 7.8 (A) Upload the requested type → (C) request shows **Done**.

## Part 8 — Access control (all must be blocked)
- [ ] 8.1 (C) open `/admin`, `/rep`, `/admin/notifications` → sent away.
- [ ] 8.2 (B) open `/admin` → sent away.
- [ ] 8.3 (C) open `/portal/orders/ORD-9999` → "Order not found".
- [ ] 8.4 Signed out: `/portal`, `/rep`, `/admin` → login pages.
- [ ] 8.5 (C) cannot see another customer's order or documents (try another order's link).

## Part 9 — Account actions (window A)
- [ ] 9.1 Disable the client (confirm) → they cannot sign in; enable → they can.
- [ ] 9.2 Reset password (confirm) → new password shown once; old one stops working.
- [ ] 9.3 Delete is greyed out for a client with orders; works for one without.
- [ ] 9.4 Client detail page: edit company / phone / rep; orders list links to the admin order.
- [ ] 9.5 Forgot password (login page) sends the (unbranded) reset email and the link works.

## Part 10 — Phone size (browser device mode, 390 px wide)
- [ ] 10.1 Admin Orders, order page, Clients: nothing cut off; tables scroll sideways; menu opens/closes.
- [ ] 10.2 Rep: New order form (size grid), order page. Customer: My Orders, order page, request form, viewer.

## Part 11 — Gap and consistency review (look at every page you visit)
Tick if it is **fine**; if not, note what is off.
- [ ] 11.1 **Dates** look the same everywhere (we know some pages show `2026-10-03` and others `03/10/2026`).
- [ ] 11.2 **Names/labels** are consistent: Overview vs Dashboard, "Compliance Certs" vs "Compliance Documents" vs "Documents", Manage vs View details, "Back to Dashboard" on a page that came from Orders.
- [ ] 11.3 **Buttons** have the same style for the same job; greyed-out buttons explain why or are obvious.
- [ ] 11.4 **Empty states** read well on every list (no orders, no documents, no notifications, no customers).
- [ ] 11.5 **Error messages** are clear when you do something wrong (blank fields, wrong file type, duplicate request, wrong password).
- [ ] 11.6 **Status badges** use the same colours on admin, rep and customer pages.
- [ ] 11.7 **Anything you expected to find but couldn't** (a button, a message, a column, a link). Write it down — these are the gaps.
- [ ] 11.8 **Anything fake or placeholder** still on screen (made-up numbers, sample names). Known: admin Dashboard numbers, Replication Queue, Products page, Sales Hiring, Import CSV.
- [ ] 11.9 **Slow or stuck** moments (spinner that never ends, page needing a refresh to show a change).

## Results
| Step | Pass / Fail / Odd | What you saw (screenshot name) |
|---|---|---|
| | | |
