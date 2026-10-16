# Rira Book Cafe

The cafe's website and staff dashboard: a menu of drinks, food and books, ordering
at the table or for takeaway, table bookings, book clubs and readings, and reports.

Next.js (App Router) · TypeScript · Tailwind v4 · Prisma + PostgreSQL · Auth.js (phone OTP) · next-intl (English / Persian).

## Run it locally

Requirements: Node 24 and Docker Desktop (for the local database).

```bash
npm install
cp .env.example .env          # then fill in AUTH_SECRET and SEED_OWNER_PHONE
npx auth secret               # prints an AUTH_SECRET to paste into .env
npm run db:dev:up             # starts Postgres on localhost:5545
npm run db:setup              # applies migrations and loads the sample data
npm run dev
```

Open http://localhost:3000.

- **Sign in** with your phone number. Without an SMS.ir key the one-time code is
  shown on the verify screen (and logged on the server).
- **Your phone in `SEED_OWNER_PHONE`** makes you the owner, so the dashboard
  (`/dashboard`) is open to you. `ADMIN_USER_IDS` does the same without the seed.
- **Sample data:** 5 categories, 13 menu items (including 3 books — one for sale,
  one for reading in the cafe only, one either way) and 2 upcoming events. Images
  are bundled under `public/images/seed`, so Supabase isn't needed to try it.
  Uploading new images does need the Supabase variables in `.env`.

Re-running `npm run db:seed` refreshes the samples (prices, event dates) without
duplicating them and leaves your own data alone.

## Database commands

| Command | What it does |
|---|---|
| `npm run db:dev:up` | Start the local Postgres container |
| `npm run db:setup` | Apply migrations, then seed |
| `npm run db:migrate` | Create a new migration after changing `prisma/schema.prisma` |
| `npm run db:deploy` | Apply migrations only (production) |
| `npm run db:seed` | Load or refresh the sample data |

## Checks

```bash
npm run typecheck
npm run lint
npm test
npm run build
```
