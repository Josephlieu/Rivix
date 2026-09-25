# RIVIX Compliance Portal

`portal.rivix.ca` — the customer and admin portal for RIVIX, an industrial workwear/uniform supplier. Built with Next.js and Supabase.

RIVIX's marketing site (`rivix.ca`) is a separate Webflow site and is not part of this repo.

## Stack

- **Framework**: Next.js (App Router)
- **Database / Auth**: Supabase (Postgres, Supabase Auth)
- **AI**: Google Gemini — garment analysis and resume screening
- **Email**: Resend — transactional email
- **Styling**: Tailwind CSS

## Roles

- **Customer** (`/portal`) — places orders through their assigned rep, tracks orders and compliance certificates
- **Admin** (`/admin`) — runs all operational work: production, shipping, certificates, supplier coordination, team management
- **Sales Rep** — not yet built; see `audit-docs/` for the planned scope

Accounts are never self-registered. Every account is created either by an admin directly, or via a sales rep's invite link.

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

You'll need a `.env.local` with Supabase and (optionally, for AI/email features) Gemini and Resend credentials — see `audit-docs/05-environment-setup.md` for the full list and where to get each one.

## Project docs

The `audit-docs/` folder is the living source of truth for this project — a full audit of the app as it existed, the confirmed requirements from client meetings, and the build plan going forward. Start with `audit-docs/00-overview.md`.

## Learn more about Next.js

- [Next.js Documentation](https://nextjs.org/docs)
- [Learn Next.js](https://nextjs.org/learn)
