import { PrismaClient } from "@prisma/client";

// One PrismaClient per process. In dev, hot-reload would otherwise spawn a new
// client (and connection pool) on every change, so we stash it on globalThis.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
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

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
