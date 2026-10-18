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
```

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
