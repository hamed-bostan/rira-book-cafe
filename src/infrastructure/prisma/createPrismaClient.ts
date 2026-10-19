import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/src/infrastructure/prisma/generated/client";

/**
 * A Prisma client on its own `pg` pool. The app uses the `prisma` singleton
 * (`./client`); the test fixtures call this directly for clients on other
 * databases — the server's `postgres` one, to create the test database. It is its
 * own module so they can do that without importing, and so building, the singleton.
 */
export function createPrismaClient(connectionString: string | undefined = process.env.DATABASE_URL): PrismaClient {
  return new PrismaClient({
    // Prisma 7 talks to Postgres through the `pg` driver rather than its own Rust
    // engine, so the pool is `pg`'s: its size (10) and timeouts are pg's defaults,
    // not the `connection_limit`/`pool_timeout` URL parameters Prisma 6 read.
    adapter: new PrismaPg({ connectionString }),
    transactionOptions: {
      // How long a transaction may wait for a pool connection. Prisma's default is
      // 2 seconds, which is less than it takes this app to open its *first*
      // connection (~2s measured cold): the first page load after a restart could
      // fail with `P2028` — "unable to start a transaction in the given time" —
      // on whichever endpoints happened to lose that race, and a refresh would fix
      // it, which is precisely the signature of a startup race rather than a slow
      // query.
      //
      // It bites here and not elsewhere because a dashboard page is not one request:
      // it fans out to five of this app's own endpoints at once (the BFF pattern),
      // and each admin list opens an interactive transaction so its rows and its
      // count come from one snapshot. Five simultaneous connection acquisitions
      // against a cold pool is the normal case for this app, not an edge one.
      //
      // Only the *acquire* wait is raised. `timeout` — how long a transaction may
      // run once it has a connection — stays at Prisma's 5s default, because that
      // one is a real guard against a write transaction holding locks, and
      // stretching it would hide the problem it exists to catch. The read batch
      // that needs longer asks for it explicitly (see `IAnalyticsRepository`).
      maxWait: 10_000,
    },
  });
}
