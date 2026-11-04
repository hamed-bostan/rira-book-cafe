import { SYSTEM_ACTOR } from "@/src/domain/entities/ActivityEntry";
import {
  LOYALTY_REASONS,
  type LapsingPoints,
  type LoyaltyReason,
  type LoyaltySettings,
  type LoyaltyTransaction,
} from "@/src/domain/entities/Loyalty";
import { ConflictError } from "@/src/domain/errors/ConflictError";
import type { AuditHook } from "@/src/domain/repositories/AuditHook";
import type { ILoyaltyRepository, PointsAdjustment, PointsExpiry } from "@/src/domain/repositories/ILoyaltyRepository";
import { prisma } from "@/src/infrastructure/prisma/client";
import { Prisma } from "@/src/infrastructure/prisma/generated/client";
import { inTransaction, type PrismaDb } from "@/src/infrastructure/prisma/transaction";

import { recordAudit } from "./writeActivityEntry";
import { lockGuestPoints, pointsBalance, readLoyaltySettings } from "./writeLoyalty";

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

  async saveSettings(settings: LoyaltySettings, audit?: AuditHook<LoyaltySettings>): Promise<LoyaltySettings> {
    return inTransaction(this.db, async (tx) => {
      const data = {
        enabled: settings.enabled,
        tomanPerPoint: settings.tomanPerPoint,
        pointValue: settings.pointValue,
        minRedeemPoints: settings.minRedeemPoints,
        pointsExpiryMonths: settings.pointsExpiryMonths,
        pointsExpirySince: settings.pointsExpirySince ? new Date(settings.pointsExpirySince) : null,
      };
      await tx.loyaltySettings.upsert({ where: { id: 1 }, create: { id: 1, ...data }, update: data });
      const saved = await readLoyaltySettings(tx);
      await recordAudit(tx, saved, audit);
      return saved;
    });
  }

  balance(userId: string): Promise<number> {
    return pointsBalance(this.db, userId);
  }

  async history(userId: string, limit: number): Promise<LoyaltyTransaction[]> {
    const rows = await this.db.loyaltyTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return rows.map(toTransaction);
  }

  async lastActivity(userId: string): Promise<string | undefined> {
    return lastActivityOf(this.db, userId);
  }

  async listLapsing(activeBefore: Date, limit: number): Promise<LapsingPoints[]> {
    // One row per guest: their balance and their last movement that counts as
    // activity (`isLoyaltyActivity` — spending, or points coming in other than an
    // expiry). Only guests still holding points, idle since before the cut-off.
    const rows = await this.db.$queryRaw<{ userId: string; balance: number; lastActivityAt: Date }[]>`
      SELECT "user_id" AS "userId",
        SUM("delta")::integer AS "balance",
        MAX("created_at") FILTER (WHERE ${ACTIVITY_SQL}) AS "lastActivityAt"
      FROM "loyalty_transactions"
      GROUP BY "user_id"
      HAVING SUM("delta") > 0 AND MAX("created_at") FILTER (WHERE ${ACTIVITY_SQL}) < ${activeBefore}
      ORDER BY "lastActivityAt", "userId"
      LIMIT ${limit}`;
    return rows.map((row) => ({
      userId: row.userId,
      balance: Number(row.balance),
      lastActivityAt: row.lastActivityAt.toISOString(),
    }));
  }

  async expire(expiry: PointsExpiry, audit?: AuditHook<LoyaltyTransaction>): Promise<number> {
    return inTransaction(this.db, async (tx) => {
      await lockGuestPoints(tx, expiry.userId);
      // Anything the guest did since the job read them keeps their points alive.
      if ((await lastActivityOf(tx, expiry.userId)) !== expiry.lastActivityAt) return 0;
      const balance = await pointsBalance(tx, expiry.userId);
      if (balance <= 0) return 0;
      const dedupeKey = `expire:${expiry.userId}:${expiry.lastActivityAt}`;
      if (await tx.loyaltyTransaction.findUnique({ where: { dedupeKey } })) return 0;
      const row = await tx.loyaltyTransaction.create({
        data: {
          userId: expiry.userId,
          delta: -balance,
          reason: "expire",
          note: expiry.note,
          dedupeKey,
          createdById: SYSTEM_ACTOR.id,
          createdByName: SYSTEM_ACTOR.name,
        },
      });
      await recordAudit(tx, toTransaction(row), audit);
      return balance;
    });
  }

  async adjust(adjustment: PointsAdjustment, audit?: AuditHook<LoyaltyTransaction>): Promise<LoyaltyTransaction> {
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
      const saved = toTransaction(row);
      await recordAudit(tx, saved, audit);
      return saved;
    });
  }
}

/** `isLoyaltyActivity` in SQL: spending, or points coming in other than an expiry. */
const ACTIVITY_SQL = Prisma.sql`"reason" = 'redeem' OR ("delta" > 0 AND "reason" <> 'expire')`;

/** The guest's last movement that counts as activity (see `isLoyaltyActivity`), as ISO 8601. */
async function lastActivityOf(
  db: Pick<Prisma.TransactionClient, "loyaltyTransaction">,
  userId: string,
): Promise<string | undefined> {
  const row = await db.loyaltyTransaction.findFirst({
    where: { userId, OR: [{ reason: "redeem" }, { delta: { gt: 0 }, reason: { not: "expire" } }] },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  return row?.createdAt.toISOString();
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
