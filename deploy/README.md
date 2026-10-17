# Deploying Rira

Production runs as two containers (`app`, `db`) on a VPS shared with other sites.
The host's own nginx proxies the public port to the app on `127.0.0.1:3100`.

```
internet ──▶ host nginx :8080 ──▶ 127.0.0.1:3100 ──▶ app container :3000 ──▶ db container :5432
             (nginx-rira.conf)                       (ghcr.io/…:production)    (postgres:17, volume pgdata)
```

| File | Where it goes | What it does |
|---|---|---|
| `bootstrap.sh` | run once as root | Creates the `deploy` user and `/opt/rira`, installs the compose file, a `.env.production` stub and the update timer |
| `nginx-rira.conf` | `/etc/nginx/sites-available/rira` | The host nginx site (installed by hand — that nginx is shared) |
| `rira-update.sh` / `.service` / `.timer` | systemd | Every ~2 min: pull `:production`, recreate `app` if the image changed |

CI builds and publishes the image on every push to `main`; the timer picks it up.
Migrations run on container start (`prisma migrate deploy`).

## Health check

`GET /api/health` (also `HEAD`) — public, uncached, answers within ~2s:

```json
{ "status": "ok", "checks": { "database": { "status": "ok", "latencyMs": 3 } }, "version": "0.1.0", "uptimeSeconds": 5120 }
```

- **200** — the server is up and the database answered.
- **503** — the server is up but the database is unreachable or too slow (`"status": "error"`).
- No response / connection refused — the app itself is down.

The image's Docker `HEALTHCHECK` calls it every 30s, so `docker compose ps` shows
`healthy` / `unhealthy`, and `docker inspect --format '{{json .State.Health}}' rira-app-1`
has the last results.

### Pointing an uptime monitor at it

Use any external HTTP monitor (Uptime Kuma, UptimeRobot, Better Stack, …). Run it
from **outside** the VPS — a monitor on the same box goes down with it.

- **URL:** `http://<server>:8080/api/health` (or `https://<domain>/api/health` once there is a domain)
- **Method:** `GET` (or `HEAD` if the monitor only checks status codes)
- **Expect:** status `200`; optionally the keyword `"status":"ok"`
- **Interval:** 60s, alert after 2–3 consecutive failures
- **Timeout:** 10s

A 503 means "app fine, database not" — check `docker compose logs db` first.

## Logs

The app writes one JSON object per line to stdout:

```bash
docker compose logs -f app                      # raw JSON
docker compose logs -f app | npx pino-pretty    # human-readable
```

`LOG_LEVEL` in `.env.production` sets the level (default `info`). nginx stamps each
request with an `X-Request-Id` (echoed on the response); app log lines and
error-tracker events for that request carry it as `requestId` / `request_id`.

## Error tracking (optional)

The app uses the Sentry SDK, which speaks the same protocol to Sentry SaaS and to a
self-hosted [GlitchTip](https://glitchtip.com). Nothing is sent until a DSN is set.

- **Server errors:** set `SENTRY_DSN` in `/opt/rira/.env.production`, then
  `docker compose up -d` to restart the app.
- **Browser errors:** the browser DSN is compiled into the client bundle, so it must
  be passed when the image is **built**: `--build-arg NEXT_PUBLIC_SENTRY_DSN=…`
  (in CI, from a repository variable).
- **Readable stack traces (optional):** build with the auth token as a BuildKit secret
  — `--secret id=sentry_auth_token,env=SENTRY_AUTH_TOKEN` — plus `SENTRY_ORG`,
  `SENTRY_PROJECT` and, for GlitchTip/self-hosted, `SENTRY_URL` build args. Without the
  token the build skips the upload.
- **Version:** `--build-arg APP_VERSION=<git sha>` shows up in `/api/health`.

Cookies, auth headers, client IPs, the signed-in user and anything that looks like a
phone number are stripped from events before they leave the server or browser.
