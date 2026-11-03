/**
 * `tsx e2e/run-background-jobs.ts [--expire-hold <id>]`: run every background job
 * once against the E2E database, as the server's runner would — which is off in
 * E2E (`JOBS_ENABLED=false`), so nothing changes under a test while it looks.
 * `--expire-hold` first moves a told guest's hold back, as if they'd been told
 * `HOLD_PICKUP_DAYS + 1` days ago, so their time to collect has run out.
 *
 * A script that calls the jobs' use-cases, rather than a test-only route: nothing
 * that runs the jobs on demand ships in the server, so there's nothing that has to
 * stay switched off outside tests.
 */
import { E2E_DATABASE_URL } from "./fixtures/env";

const DAY_MS = 24 * 60 * 60 * 1000;

async function main(): Promise<void> {
  // The Prisma client reads DATABASE_URL when it's first imported, so point it at
  // the E2E database before loading anything that touches it.
  process.env.DATABASE_URL = E2E_DATABASE_URL;
  const { HOLD_PICKUP_DAYS, holdPickupDeadline } = await import("../src/domain/entities/BookWaitlist");
  const { createBackgroundJobs } = await import("../src/infrastructure/jobs/backgroundJobs");
  const { prisma } = await import("../src/infrastructure/prisma/client");
  try {
    const flag = process.argv.indexOf("--expire-hold");
    if (flag >= 0) {
      const notifiedAt = new Date(Date.now() - (HOLD_PICKUP_DAYS + 1) * DAY_MS);
      await prisma.bookWaitlistEntry.update({
        where: { id: process.argv[flag + 1], status: "notified" },
        data: { notifiedAt, pickupBy: holdPickupDeadline(notifiedAt) },
      });
    }
    const now = new Date();
    for (const job of createBackgroundJobs()) await job.run(now);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
