import { DEFAULT_LOYALTY_SETTINGS, pointsEarnedFor, type LoyaltySettings } from "@/src/domain/entities/Loyalty";
import { ConflictError } from "@/src/domain/errors/ConflictError";

import type { Prisma } from "@prisma/client";

/**
 * The single write path into the points ledger, inside the caller's transaction —
 * so an order and the points it spends or earns commit together. Balances are
 * checked under a per-guest advisory lock (the database trigger takes the same
 * lock and repeats the check as a backstop).
 */

export async function readLoyaltySettings(tx: Prisma.TransactionClient): Promise<LoyaltySettings> {
  const row = await tx.loyaltySettings.findUnique({ where: { id: 1 } });
  if (!row) return DEFAULT_LOYALTY_SETTINGS;
  return {
    enabled: row.enabled,
    tomanPerPoint: row.tomanPerPoint,
    pointValue: row.pointValue,
    minRedeemPoints: row.minRedeemPoints,
  };
}

export async function lockGuestPoints(tx: Prisma.TransactionClient, userId: string): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`loyalty:${userId}`}))`;
}

/** The guest's balance: the sum of their ledger. Works on the root client or inside a transaction. */
export async function pointsBalance(db: Pick<Prisma.TransactionClient, "loyaltyTransaction">, userId: string): Promise<number> {
  const result = await db.loyaltyTransaction.aggregate({ where: { userId }, _sum: { delta: true } });
  return result._sum.delta ?? 0;
}

/** Take points off the guest for an order. Refused when they don't have them. */
export async function redeemPoints(
  tx: Prisma.TransactionClient,
  order: { id: string; orderNumber: number; userId: string },
  points: number,
): Promise<void> {
  if (points <= 0) return;
  await lockGuestPoints(tx, order.userId);
  const balance = await pointsBalance(tx, order.userId);
  if (balance < points) throw new ConflictError("NOT_ENOUGH_POINTS", `Only ${balance} points left; ${points} needed.`);
  await tx.loyaltyTransaction.create({
    data: {
      userId: order.userId,
      delta: -points,
      reason: "redeem",
      orderId: order.id,
      orderNumber: order.orderNumber,
      dedupeKey: `order:${order.id}:redeem`,
    },
  });
}

/** A cancelled order gives back the points it spent (once). */
export async function refundPoints(
  tx: Prisma.TransactionClient,
  order: { id: string; orderNumber: number; userId: string; pointsRedeemed: number },
): Promise<void> {
  if (order.pointsRedeemed <= 0) return;
  const existing = await tx.loyaltyTransaction.findUnique({ where: { dedupeKey: `order:${order.id}:refund` } });
  if (existing) return;
  await tx.loyaltyTransaction.create({
    data: {
      userId: order.userId,
      delta: order.pointsRedeemed,
      reason: "refund",
      orderId: order.id,
      orderNumber: order.orderNumber,
      dedupeKey: `order:${order.id}:refund`,
    },
  });
}

/** A completed order earns its points (once), recorded on the order too. Returns what it earned. */
export async function earnPoints(
  tx: Prisma.TransactionClient,
  order: { id: string; orderNumber: number; userId: string; total: number },
): Promise<number> {
  const points = pointsEarnedFor(order.total, await readLoyaltySettings(tx));
  if (points <= 0) return 0;
  const existing = await tx.loyaltyTransaction.findUnique({ where: { dedupeKey: `order:${order.id}:earn` } });
  if (existing) return existing.delta;
  await tx.loyaltyTransaction.create({
    data: {
      userId: order.userId,
      delta: points,
      reason: "earn",
      orderId: order.id,
      orderNumber: order.orderNumber,
      dedupeKey: `order:${order.id}:earn`,
    },
  });
  await tx.order.update({ where: { id: order.id }, data: { pointsEarned: points } });
  return points;
}
