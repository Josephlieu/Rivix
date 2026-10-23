# RIVIX portal: notes for Claude Code

Read `audit-docs/29-project-handoff.md` first (full context: what is built, what is pending, blockers, decisions). The older audit history starts at `audit-docs/00-overview.md`. `audit-docs/` is local only (gitignored); if it is missing, ask the user for their copy.

Key facts
- Custom single-company portal (customer, sales rep, admin, later supplier) on Next.js 16 + Supabase + Resend + Gemini. Not SaaS, not a full CRM. Read `node_modules/next/dist/docs/` before relying on memory of Next.js APIs.
- `.env.local` points at the DEV Supabase project. Never run the e2e tests against the live project. Never put keys or personal data in files or messages.
- Dev server: `npm run dev` (port 10001). Check work with `npx tsc --noEmit`, `npx eslint <files>`, a build, and `scripts/e2e/*.test.mjs`.

Working rules the user has set
- Do not push, run SQL, change the live database, or send emails/messages on the user's behalf unless explicitly asked. The user runs SQL in Supabase.
- Commit signing needs the user's SSH passphrase; if a commit hangs, do not disable signing unless the user says so.
- Answer in plain language, lists preferred over tables, short when asked. Drafts for Fiverr and the client are written for the user to send; never claim something is live.

- Email: `src/lib/email.ts` sends through Resend and never throws (a failed email must not undo an action; the admin gets a warning). Sender = `NOTIFY_FROM_EMAIL` or `HIRING_FROM_EMAIL`. Candidate emails and rep-change emails need a verified rivix.ca sender; until proven, treat email as unconfirmed.
- One rep per customer: every rep access rule follows the customer's rep. "No rep" means the admin handles the customer (shown as "Admin (handled directly)").
