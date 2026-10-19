# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html). Commit messages follow
[Conventional Commits](https://www.conventionalcommits.org) — `feat` entries go under
**Added**, `fix` under **Fixed**, and so on.

## [Unreleased]

### Added

- Error tracking with the Sentry SDK for the server, edge and browser runtimes. Optional
  and env-configured (works with Sentry SaaS or a self-hosted GlitchTip); cookies, auth
  headers, IPs, the user and phone numbers are scrubbed before events are sent.
- Structured logging through an `ILogger` port with a pino implementation: JSON lines in
  production, pretty output in dev, request-id correlation via nginx's `X-Request-Id`,
  and error-level lines reported to the error tracker.
- `GET /api/health` (version + database check; 503 when the database is down) and a
  Docker `HEALTHCHECK` that uses it.
- Developer tooling: Prettier (with Tailwind class sorting), husky + lint-staged
  pre-commit checks, commitlint (Conventional Commits), `eslint-plugin-jsx-a11y`
  (recommended rules, as warnings for now) and `.editorconfig`.
- Documentation: architecture overview, scripts and environment variables in the
  README; deployment, uptime monitoring and logging in `deploy/README.md`.

### Changed

- Server code no longer logs with `console.*`; infrastructure adapters receive the
  logger from the container.
- Prisma 7: the client is generated into `src/infrastructure/prisma/generated` (on
  `npm install`) and reaches Postgres through the `pg` driver adapter; CLI settings
  (schema, migrations, seed, `DATABASE_URL`) moved to `prisma.config.ts`.

## [0.1.0]

_Untagged — the state of `main` before this changelog was started._

First production release on the VPS: the public site (menu, ordering, table booking,
events, book loans, the suite), guest accounts with phone OTP sign-in, notifications
and reviews, and the staff dashboard (orders and kitchen display, menu and inventory,
reservations, team and activity log, double-entry accounting, pricing advisor, cash
shifts and bank reconciliation, Zarinpal payments, reports). Deployed with Docker
behind the host nginx, with CI publishing the image to GHCR.
