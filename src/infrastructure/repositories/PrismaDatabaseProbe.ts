import type { IDatabaseProbe } from "@/src/domain/repositories/IDatabaseProbe";
import { prisma } from "@/src/infrastructure/prisma/client";

/** {@link IDatabaseProbe} over the shared Prisma pool: one round trip, no table touched. */
export class PrismaDatabaseProbe implements IDatabaseProbe {
  async ping(): Promise<void> {
    await prisma.$queryRaw`SELECT 1`;
  }
}
