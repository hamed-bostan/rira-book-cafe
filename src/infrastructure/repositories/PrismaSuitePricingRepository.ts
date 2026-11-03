import type { SuiteBooking } from "@/src/domain/entities/SuiteBooking";
import type { SuiteSettings } from "@/src/domain/entities/SuitePricing";
import { NotFoundError } from "@/src/domain/errors/NotFoundError";
import type { AuditHook } from "@/src/domain/repositories/AuditHook";
import type { ISuitePricingRepository } from "@/src/domain/repositories/ISuitePricingRepository";
import { prisma } from "@/src/infrastructure/prisma/client";
import { inTransaction, type PrismaDb } from "@/src/infrastructure/prisma/transaction";

import { toSuiteBooking } from "./PrismaSuiteBookingRepository";
import { readSuiteSettings } from "./readSuiteSettings";
import { recordAudit } from "./writeActivityEntry";

/** The suite's price list and each stay's rate, backed by PostgreSQL via Prisma. */
export class PrismaSuitePricingRepository implements ISuitePricingRepository {
  constructor(private readonly db: PrismaDb = prisma) {}

  getSettings(): Promise<SuiteSettings> {
    return readSuiteSettings(this.db);
  }

  async updateSettings(settings: SuiteSettings, audit?: AuditHook<SuiteSettings>): Promise<SuiteSettings> {
    return inTransaction(this.db, async (tx) => {
      const nightlyRate = BigInt(settings.nightlyRate);
      await tx.suiteSettings.upsert({
        where: { id: 1 },
        create: { id: 1, nightlyRate },
        update: { nightlyRate },
      });
      const saved = await readSuiteSettings(tx);
      await recordAudit(tx, saved, audit);
      return saved;
    });
  }

  async setStayRate(id: string, nightlyRate: number, audit?: AuditHook<SuiteBooking>): Promise<SuiteBooking> {
    return inTransaction(this.db, async (tx) => {
      const result = await tx.suiteBooking.updateMany({ where: { id }, data: { nightRate: BigInt(nightlyRate) } });
      if (result.count === 0) throw new NotFoundError("suite booking", id);
      const saved = toSuiteBooking(await tx.suiteBooking.findUniqueOrThrow({ where: { id } }));
      await recordAudit(tx, saved, audit);
      return saved;
    });
  }
}
