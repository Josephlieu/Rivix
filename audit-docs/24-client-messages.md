# 24 — Messages drafted for Joseph (2026-10-03)

Drafts only; nothing here has been sent by me. Demo logins are NOT stored in this file (it is committed to git); they are in the private session log. Fill `[link]` and `[logins]` before sending. **Do not send until the latest code is pushed and redeployed** — the live site was still on the old version on 2026-10-03.

## A. Progress update — what is working
Sections: how it works in short (client asks rep → rep enters order → admin runs it → everyone follows, with notifications); accounts and security (own admin logins, create client/rep with temporary password by WhatsApp/email, codes CUS-/REP-/ORD-, one rep per client, edit/disable/delete, locked-out immediately, privacy between clients and reps, AI tools locked to admin); orders (rep enters several products with a size grid, admin list with filters, stages, carrier/tracking, customer-visible vs internal notes, timeline); documents (private upload, in-page preview of PDF/Word/image, download, real documents only); document requests (client asks once shipped → rep → admin; rep can ask admin; closes by itself on upload); notifications (bell, unread count, full page, mark read; who is told for each event; welcome message); polish (branded 404, phone layouts, popups, clear disabled-account message). Ends with "How to try it" (link, three demo logins, 5 steps, use private windows).

## B. Testing update
Explains: automated checks (183, all passing — orders, order handling, privacy, documents, notifications, document requests, disabled accounts; one check found a privacy gap that was fixed), hands-on testing (found screens/viewer/login-loop issues, all fixed). Honest "not finished yet": newest features' full pass, phones, and a full re-run on the real system before launch with his approval. Asks for his feedback. Left out on purpose: our internal mishaps and clean-up.

## C. Earlier drafts still on file
- Supplier portal: 12 business questions with a suggested default beside each (NDA wording, screening criteria, winner-notification window, negotiation approval/rounds, losing suppliers, CAD/USD, tender source, whole vs partial tenders, the main RFP, tall/maternity sizes, AI bill + big-file storage, DNS access) — questions list is in `16-meeting-questions.md` C3.
- Branded email: plan to use Resend with his GoDaddy DNS (we send the records for him to paste, or he adds us as a delegate; never share the password).

## Pre-send checklist
1. Push the commits and redeploy on Vercel; check the live link with the demo logins in a private window.
2. Demo accounts (admin / rep / client) exist on the dev database; delete them before real launch.
3. Demo client code looks high (`CUS-0043`) because tests used numbers — harmless, can be renumbered.
