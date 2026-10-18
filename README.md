# Rira Book Cafe

The cafe's website and staff dashboard: a menu of drinks, food and books, ordering
at the table or for takeaway, table bookings, book clubs and readings, and reports.

Next.js 16 (App Router) · TypeScript (strict) · Tailwind v4 · Radix UI · Prisma + PostgreSQL ·
Auth.js v5 (phone OTP) · next-intl (English / Persian, RTL) · Vitest · Sentry SDK · pino.

## Architecture

Clean Architecture: the business rules sit in the middle and know nothing about
Next.js, Prisma or HTTP. **Dependencies only point inward.**

```
          app/  (Next.js routes)                  src/presentation/  (UI)
   ┌─────────────────────────────────┐    ┌──────────────────────────────────┐
   │ app/api/**  REST route handlers │◀───│ typed Axios services (BFF calls) │
   │ thin: auth → Zod → use-case →   │HTTP│ Server Components + client forms │
   │ map domain errors to HTTP       │    │ design-system/ (Radix + tokens)  │
   └───────────────┬─────────────────┘    └────────────────┬─────────────────┘
                   │                                       │ (shares only src/contracts)
                   ▼                                       ▼
   ┌──────────────────────────────────────────────────────────────────────────┐
   │ src/domain — entities, use-cases, ports (IXxx types), domain errors      │
   │ framework-free: no next, no prisma, no infrastructure/presentation       │
   └──────────────────────────────────────────────────────────────────────────┘
                   ▲ implements ports
   ┌───────────────┴──────────────────────────────────────────────────────────┐
   │ src/infrastructure — Prisma repositories, disk image storage, SMTP, SMS, │
   │ Zarinpal, pino logger. container.ts is the ONLY composition root.        │
   └──────────────────────────────────────────────────────────────────────────┘
```

| Layer                         | Folder                             | May import                                                                          |
| ----------------------------- | ---------------------------------- | ----------------------------------------------------------------------------------- |
| Domain                        | `src/domain`                       | nothing outside itself                                                              |
| Contracts                     | `src/contracts`                    | Zod only — schemas shared by route handlers **and** client forms                    |
| Infrastructure                | `src/infrastructure`               | domain                                                                              |
| API (backend half of the BFF) | `app/api`                          | domain, contracts, `infrastructure/container`, `src/lib` — never `src/presentation` |
| Presentation (frontend half)  | `src/presentation`, `app/[locale]` | contracts, `src/lib` — talks to the backend over HTTP only                          |
| Cross-cutting                 | `src/lib`                          | helpers, auth guards, API client/response helpers, observability                    |

- **Composition root** — `src/infrastructure/container.ts` binds every port to its
  implementation (Prisma, mocks, local disk, SMTP or a logging stub…). Nothing else
  instantiates an adapter.
- **BFF over HTTP** — even Server Components read data through the REST API
  (`serverApiGet`), so the UI behaves exactly as it would against a separate backend.
  Mutations call the browser Axios service, then `router.refresh()`.
- The boundaries are enforced by ESLint (`no-restricted-imports` in `eslint.config.mjs`).
  See [CLAUDE.md](CLAUDE.md) for the full set of conventions.

## Run it locally

Requirements: Node 24 (see `.nvmrc`) and Docker Desktop (for the local database).

```bash
npm install                   # also installs the git hooks (husky)
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

## Scripts

| Command                           | What it does                                                  |
| --------------------------------- | ------------------------------------------------------------- |
| `npm run dev`                     | Dev server (regenerates design tokens first)                  |
| `npm run build` / `npm start`     | Production build / serve it                                   |
| `npm run lint`                    | ESLint (type-aware, architecture boundaries, a11y)            |
| `npm run typecheck`               | `tsc --noEmit`                                                |
| `npm test`                        | Unit tests (Vitest, no database needed)                       |
| `npm run format` / `format:check` | Prettier write / check (Tailwind classes sorted)              |
| `npm run generate:tokens`         | Rebuild `src/styles/tokens.css` from the design-system tokens |
| `npm run bundle:size`             | First-load JS (gzip) per page, from the last `npm run build`  |
| `npm run bundle:check`            | Same, failing past `bundle-budget.json` (CI runs it)          |
| `npm run analyze`                 | Webpack build with bundle treemaps in `.next/analyze/`        |
| `npm run db:dev:up`               | Start the local Postgres container                            |
| `npm run db:setup`                | Apply migrations, then seed                                   |
| `npm run db:migrate`              | Create a new migration after changing `prisma/schema.prisma`  |
| `npm run db:deploy`               | Apply migrations only (production)                            |
| `npm run db:seed`                 | Load or refresh the sample data                               |
| `npm run db:generate`             | Regenerate the Prisma client                                  |

Before pushing:

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run bundle:check
```

**Performance guardrails.** Import design-system components from their own module
(`…/design-system/components/Button/Button`), never through a barrel; ESLint enforces
it, because one barrel import from a Server Component shipped the whole design system
on every page. Public catalog reads are cached and expired by tag (`src/lib/cache-tags.ts`):
a new write route that changes products, categories or events must be wrapped in
`invalidatesCatalog`.

### Git hooks and commit messages

`npm install` sets up [husky](https://typicode.github.io/husky/) hooks:

- **pre-commit** — `lint-staged` runs `eslint --fix` and Prettier on the staged files only.
- **commit-msg** — commitlint enforces [Conventional Commits](https://www.conventionalcommits.org):
  `feat(orders): …`, `fix: …`, `chore(deps): …`, `docs: …`. Notable changes go in
  [CHANGELOG.md](CHANGELOG.md).

## Environment variables

Copy `.env.example` (local) or `.env.production.example` (server); both document every
variable. The important ones:

| Variable                                                          | Required | Purpose                                                                                     |
| ----------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                                                    | yes      | PostgreSQL connection string                                                                |
| `AUTH_SECRET`                                                     | yes      | Auth.js session signing (`npx auth secret`)                                                 |
| `ADMIN_USER_IDS`                                                  | —        | Break-glass owner phone ids                                                                 |
| `SMS_IR_API_KEY`, `SMS_IR_TEMPLATE_ID`                            | prod     | Real SMS OTP; without them a mock shows the code on screen                                  |
| `OTP_MOCK`                                                        | —        | `true` forces the mock OTP                                                                  |
| `UPLOADS_DIR`                                                     | —        | Where uploaded images are stored (default `./storage/uploads`)                              |
| `APP_URL`, `API_BASE_URL`, `NEXT_PUBLIC_SITE_URL`                 | —        | Public origin / server-side BFF base / metadata URL                                         |
| `SMTP_*`                                                          | —        | Team emails; without SMTP they are logged                                                   |
| `ZARINPAL_MERCHANT_ID`, `ZARINPAL_SANDBOX`                        | —        | Online payments (sandbox without a merchant id)                                             |
| `LOG_LEVEL`                                                       | —        | `debug` (dev default), `info` (prod default), … `silent`                                    |
| `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`                            | —        | Error tracking (Sentry or GlitchTip); empty = off. The public one is read at **build** time |
| `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_URL` | —        | Build-time source-map upload; skipped without the token                                     |

## Observability

- **Logs** — `logger` from the container (`ILogger` port, pino): pretty in dev, JSON
  lines on stdout in production. Route handlers use `requestLogger(request)` so lines
  carry the `X-Request-Id` nginx assigns. Don't use `console.*` in server code (ESLint
  enforces it).
- **Errors** — Sentry SDK on the server, edge and browser (`instrumentation*.ts`,
  `sentry.*.config.ts`). Error-level log lines are reported too. Cookies, auth
  headers, IPs, the user and phone numbers are scrubbed (`src/lib/observability`).
- **Health** — `GET /api/health`: 200 with version and DB status, 503 when the DB
  is down. Used by the Docker `HEALTHCHECK`.

## Deploying

Production is a Docker image (`Dockerfile`) published by CI to GHCR and run with
`docker-compose.yml` on a VPS behind the host's nginx. See
[deploy/README.md](deploy/README.md) for the layout, health checks, uptime
monitoring, logs and error-tracker setup.

## Tests

Three layers, from many and fast to few and slow:

| Layer       | Command                    | What it covers                                                                                                                                                                                                                                                    | Needs                        |
| ----------- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| Unit        | `npm test`                 | Domain entities and use-cases (with in-memory fakes of the repository ports), the shared Zod contracts, small UI helpers                                                                                                                                          | Nothing                      |
| Coverage    | `npm run test:coverage`    | The unit tests, failing below 80% lines/statements/functions (75% branches) in `src/domain` or `src/contracts`. HTML report in `coverage/`                                                                                                                        | Nothing                      |
| Integration | `npm run test:integration` | The REST route handlers + use-cases + Prisma repositories against a real Postgres: auth on writes (401), validation (400 with `fieldErrors`), 404, 409 and the happy paths for products, categories, orders, events, accounting, inventory and uploads            | The test database            |
| E2E         | `npm run test:e2e`         | A few critical flows in a real browser against a production build: sign-in, menu → basket → order, an admin creating/editing/deleting an item with its image, the dashboard refusing non-staff, switching language, and axe accessibility checks on the key pages | The test database, a browser |

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
