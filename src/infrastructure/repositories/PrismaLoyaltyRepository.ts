import { LOYALTY_REASONS, type LoyaltyReason, type LoyaltySettings, type LoyaltyTransaction } from "@/src/domain/entities/Loyalty";
import { ConflictError } from "@/src/domain/errors/ConflictError";
import type { ILoyaltyRepository, PointsAdjustment } from "@/src/domain/repositories/ILoyaltyRepository";
import { prisma } from "@/src/infrastructure/prisma/client";
import { inTransaction, type PrismaDb } from "@/src/infrastructure/prisma/transaction";

import { lockGuestPoints, pointsBalance, readLoyaltySettings } from "./writeLoyalty";

import type { Prisma } from "@prisma/client";

/**
 * The loyalty club's settings and points ledger, backed by PostgreSQL via Prisma.
 * The order repository writes the points orders earn and spend (see
 * `writeLoyalty`); this one reads balances and makes manual adjustments.
 */
export class PrismaLoyaltyRepository implements ILoyaltyRepository {
  constructor(private readonly db: PrismaDb = prisma) {}

  getSettings(): Promise<LoyaltySettings> {
    return inTransaction(this.db, (tx) => readLoyaltySettings(tx));
  }

  async saveSettings(settings: LoyaltySettings): Promise<LoyaltySettings> {
    await this.db.loyaltySettings.upsert({ where: { id: 1 }, create: { id: 1, ...settings }, update: settings });
    return settings;
  }

  balance(userId: string): Promise<number> {
    return pointsBalance(this.db, userId);
  }

  async history(userId: string, limit: number): Promise<LoyaltyTransaction[]> {
    const rows = await this.db.loyaltyTransaction.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: limit });
    return rows.map(toTransaction);
  }

  async adjust(adjustment: PointsAdjustment): Promise<LoyaltyTransaction> {
    return inTransaction(this.db, async (tx) => {
      if (adjustment.delta < 0) {
        await lockGuestPoints(tx, adjustment.userId);
        const balance = await pointsBalance(tx, adjustment.userId);
        if (balance + adjustment.delta < 0) {
          throw new ConflictError("NOT_ENOUGH_POINTS", `The guest has only ${balance} points.`);
        }
      }
      const row = await tx.loyaltyTransaction.create({
        data: {
          userId: adjustment.userId,
          delta: adjustment.delta,
          reason: "adjust",
          note: adjustment.note,
          createdById: adjustment.by.id,
          createdByName: adjustment.by.name,
        },
      });
      return toTransaction(row);
    });
  }
}

type TransactionRow = Prisma.LoyaltyTransactionGetPayload<object>;

function toReason(value: string): LoyaltyReason {
  return (LOYALTY_REASONS as readonly string[]).includes(value) ? (value as LoyaltyReason) : "adjust";
}

function toTransaction(row: TransactionRow): LoyaltyTransaction {
  return {
    id: row.id,
    userId: row.userId,
    delta: row.delta,
    reason: toReason(row.reason),
    orderId: row.orderId ?? undefined,
    orderNumber: row.orderNumber ?? undefined,
    note: row.note ?? undefined,
    createdByName: row.createdByName ?? undefined,
    createdAt: row.createdAt.toISOString(),
  };
}
