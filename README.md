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
  are bundled under `public/images/seed`, so no upload storage is needed to try it.
  Uploaded images are written to `storage/uploads` (or `UPLOADS_DIR`) and served from `/uploads`.

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

## Tests

Three layers, from many and fast to few and slow:

| Layer | Command | What it covers | Needs |
|---|---|---|---|
| Unit | `npm test` | Domain entities and use-cases (with in-memory fakes of the repository ports), the shared Zod contracts, small UI helpers | Nothing |
| Coverage | `npm run test:coverage` | The unit tests, failing below 80% lines/statements/functions (75% branches) in `src/domain` or `src/contracts`. HTML report in `coverage/` | Nothing |
| Integration | `npm run test:integration` | The REST route handlers + use-cases + Prisma repositories against a real Postgres: auth on writes (401), validation (400 with `fieldErrors`), 404, 409 and the happy paths for products, categories, orders, events, accounting, inventory and uploads | The test database |
| E2E | `npm run test:e2e` | A few critical flows in a real browser against a production build: sign-in, menu → basket → order, an admin creating/editing/deleting an item with its image, the dashboard refusing non-staff, switching language, and axe accessibility checks on the key pages | The test database, a browser |

The integration and E2E suites use a throwaway Postgres on port 5546 — never the dev
database. They wipe it, and refuse to run against a database whose name lacks `test`.

```bash
npm run db:test:up
```

(`npm run db:test:down` stops it; its data lives in memory, so that discards it.)

**Integration** (`tests/integration/`) calls each route handler directly with a real
`Request`. Only Auth.js's `auth()` is faked: a test picks who is signed in with
`signInAs("admin")`, and the real guards still read that user's role from the database.
The database is migrated once per run and restored to the seeded state before every test.

**E2E** (`e2e/`) runs Playwright against `next build` + `next start` on port 3200, never
the dev server. Before the server starts, `e2e/prepare-database.ts` migrates and seeds the
E2E database, with one test account per role (`tests/fixtures/users.ts`). Sign-in is the
mock OTP, which shows the code on screen, so there are no passwords. One spec signs in
through the real screens; the others start signed in with a session cookie minted with
the run's test-only secret.

```bash
npx playwright install chromium
```

```bash
npm run test:e2e
```

```bash
npx playwright show-report
```

- The first command is needed once; the last opens the HTML report, with a trace of any failure.
- `E2E_SKIP_BUILD=1` reuses the current `.next` build. A server already listening on port
  3200 is reused as it is, so stop it after changing code.
- `E2E_BROWSER_CHANNEL=msedge` (or `chrome`) drives an installed browser instead, for when
  `playwright install` can't download Chromium.
- Accessibility: every axe violation is attached to the report; serious and critical ones
  fail the test.

CI (`.github/workflows/ci.yml`) runs lint, typecheck and the unit tests with coverage, the
integration and E2E suites (each with its own Postgres service container), and
`npm audit --audit-level=high` as a separate job. The Docker image is built and published
only after the unit, integration and E2E jobs pass; a failed E2E run uploads the
Playwright report and traces as an artifact.
