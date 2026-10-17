# syntax=docker/dockerfile:1

# Keep in sync with .nvmrc — npm ships bundled with Node, so this pins the npm
# that writes/reads package-lock.json. A mismatch desyncs the lockfile.
ARG NODE_VERSION=24

# ---- deps: install all deps (dev included — needed to build, and the Prisma CLI at runtime) ----
FROM node:${NODE_VERSION}-alpine AS deps
WORKDIR /app
# libc6-compat for native modules; openssl for Prisma's query engine.
RUN apk add --no-cache libc6-compat openssl
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

# ---- builder: generate the Prisma client, then run prebuild (tokens) + next build ----
FROM node:${NODE_VERSION}-alpine AS builder
WORKDIR /app
RUN apk add --no-cache openssl
ENV NEXT_TELEMETRY_DISABLED=1
# Dummy URL so any build-time Prisma instantiation is satisfied; no DB is contacted
# at build (the data pages are force-dynamic). The real URL is injected at runtime.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build?schema=public"
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

# ---- runner: production server. Full node_modules so Prisma's client, engine, and
#      migrate CLI are all present — no standalone file-tracing to fight. ----
FROM node:${NODE_VERSION}-alpine AS runner
WORKDIR /app
RUN apk add --no-cache openssl
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/prisma ./prisma

EXPOSE 3000
# Apply pending migrations (a no-op when already up to date), then start the server.
CMD ["sh", "-c", "npx prisma migrate deploy && npm run start"]
