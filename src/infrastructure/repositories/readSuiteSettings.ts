import { DEFAULT_SUITE_NIGHTLY_RATE, type SuiteSettings } from "@/src/domain/entities/SuitePricing";
import type { PrismaDb } from "@/src/infrastructure/prisma/transaction";

/** The suite's price list — the default before its row exists. */
export async function readSuiteSettings(db: Pick<PrismaDb, "suiteSettings">): Promise<SuiteSettings> {
  const row = await db.suiteSettings.findUnique({ where: { id: 1 } });
  return { nightlyRate: row ? Number(row.nightlyRate) : DEFAULT_SUITE_NIGHTLY_RATE };
}
