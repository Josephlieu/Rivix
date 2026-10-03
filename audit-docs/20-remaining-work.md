# 20 — What is left, by panel, with milestones and hours (2026-10-01)

My own rough estimates (normal build hours, not a quote). They supersede the older totals in `08-full-project-scope.md` and `14-milestone-timeline.md`, which predate what has been built and the decisions since. Supplier Hub is separate (see `17-supplier-hub.md`, ~176–264h). Items marked **needs Joseph** can't start until he answers or gives access.

## Where we are
Done and tested: customer / rep / admin logins and role separation; admin creates customers and reps (credentials card, WhatsApp/email), assigns one rep per customer, disable/delete/reset; unique codes (CUS-, REP-, ORD-); rep creates orders (multi-product, size grid); admin Orders (stages, tracking, notes, timeline); customer order view with progress; documents/certificates upload and download (private Supabase storage); branded 404, mobile fixes; AI routes locked to admin.

## Customer panel — left
| Item | Hours | Note |
|---|---|---|
| Real notifications (bell: order stage changed, document uploaded) | shared, see below | bell is empty now |
| Customer overview numbers | done 10-01 | "Compliance Certificates" was `orders × 3` (fake) — now a real document count |
| Product Specs: admin-managed technical files per customer | 5–7 | table + private bucket exist; **no admin upload screen yet** |
| QuickBooks invoices / POs shown read-only, "Request Invoice" button | 20–30 | **needs Joseph** (QuickBooks access; confirmed Online, invoices only; save QuickBooks customer ID on the account) |
| Reproduce Joseph's "logout glitches the site" report | 1–3 | never reproduced |
| Forced password change on first login (optional) | 3–4 | not requested |
| **Customer total (excl. QuickBooks)** | **~9–14** | |

## Sales rep panel — left
| Item | Hours | Note |
|---|---|---|
| "Ping admin" (rep asks admin for a document / certificate) | 4–6 | Joseph 09-29; needs an admin inbox for requests |
| Rep-shared sign-up link so customers register under their rep | 6–10 | Joseph 09-25 (no open self-signup) |
| Uniform Replication as an internal rep/admin tool (real data, chat, status, carrier choices) | 28–37 | current admin Replication Queue is 2,000 lines of fake/local data; **needs Joseph** on "approved sample → order" handoff (§6b) |
| Rep edit/cancel own order before admin picks it up | 2–4 | rule not defined yet |
| **Rep total** | **~40–57** | |

## Admin panel — left
| Item | Hours | Note |
|---|---|---|
| Dashboard with real numbers (orders by stage, new orders, clients) | 4–6 | currently fake |
| Product Specs upload per customer (see customer panel) | counted above | |
| Products page (static catalog PDF → upload a new version yourself) | 2–4 | **needs Joseph** (does he want this?) |
| Sales Hiring: fix missing table / silent local-storage fallback, remove in-app SOP panel (delivered as PDF), per-job criteria | 8–12 | real candidate data present |
| Import CSV: stop silently substituting fake data, add column mapping | 8–12 | **needs Joseph's real spreadsheet** |
| Admin 2FA (authenticator app) | 4–6 | required for Supplier Hub, good practice anyway |
| Admin inbox for rep requests ("ping admin") | counted in rep row | |
| **Admin total** | **~26–40** | |

## Cross-cutting — left
| Item | Hours | Note |
|---|---|---|
| Notifications system (events, bell for all three roles, optional email) | 10–14 | **needs Joseph**: email too, or in-app only? |
| Branded emails via Resend (reset password, new account) | 4–6 | **needs GoDaddy DNS access** |
| Production launch: apply every SQL file to the real Supabase project, fix `rep_client_chats` (security off, real names/emails exposed), env keys, Vercel production deploy, data migration | 12–20 | **needs Joseph**: production project access/plan, which data to bring over |
| Testing and fixes across all roles (dedicated, not free) | 15–25 | per §12 of the requirements |

## Milestones
| # | Milestone | Hours | Blocked on |
|---|---|---|---|
| M1 | Core order loop (customer → rep → admin → documents) | **done** | — |
| M2 | Everyday polish: ping admin, notifications, real dashboard, rep sign-up link, branded email | ~29–41 | DNS access, notification email decision |
| M3 | Admin back office: product specs upload, products page, hiring fix, import fix, 2FA | ~27–41 | Joseph's spreadsheet; products decision |
| M4 | Replication as rep/admin tool | ~28–37 | Joseph's handoff answer |
| M5 | QuickBooks invoices / POs | ~20–30 | QuickBooks access |
| M6 | Launch prep: production database, QA, deploy | ~27–45 | production access + plan |
| | **Total remaining (without Supplier Hub)** | **~131–194** | |
| M7 | Supplier Hub (after the above go live) | ~176–264 | Joseph's remaining answers, DNS, tech file format |

Recommended order: M2 → M3 (the parts not blocked) while waiting on Joseph for M4/M5/M6 inputs; do M6 once everything Joseph-approved is built. Pace depends on weekly hours; at ~20–25h/week, M2–M6 is roughly 6–9 weeks.
