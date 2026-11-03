import { prisma } from "@/src/infrastructure/prisma/client";
import type { PrismaClient } from "@/src/infrastructure/prisma/generated/client";

import type { JobLock } from "./JobRunner";

/**
 * A run of the background jobs at a time, across every server instance: a
 * transaction-scoped Postgres advisory lock, held for the run by a transaction
 * that stays open around it. `pg_try_…` doesn't wait — a second instance, or an
 * overlapping tick, skips its turn instead of queueing behind the first. The lock
 * goes with the transaction, so a crashed run can't leave it held.
 *
 * The jobs' own queries run on other pool connections, outside this transaction:
 * it exists only to hold the lock. A run that outlasts `maxRunMs` has its
 * transaction closed under it — the lock is released and the run reports an error;
 * the jobs themselves are guarded and keyed, so a second run overlapping it is
 * still safe.
 */
export class PostgresJobLock implements JobLock {
  constructor(
    private readonly key: string,
    private readonly maxRunMs: number,
    private readonly db: PrismaClient = prisma,
  ) {}

  runExclusive(work: () => Promise<void>): Promise<boolean> {
    return this.db.$transaction(
      async (tx) => {
        const [row] = await tx.$queryRaw<{ locked: boolean }[]>`
          SELECT pg_try_advisory_xact_lock(hashtext(${this.key})) AS locked`;
        if (!row?.locked) return false;
        await work();
        return true;
      },
      { timeout: this.maxRunMs },
    );
  }
}
