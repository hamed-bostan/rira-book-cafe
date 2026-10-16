import { Prisma, type PaymentAttempt as PaymentAttemptRow } from "@prisma/client";

import {
  PAYMENT_ATTEMPT_STATUSES,
  PAYMENT_FAILURE_REASONS,
  type PaymentAttempt,
  type PaymentAttemptStatus,
  type PaymentFailureReason,
} from "@/src/domain/entities/PaymentAttempt";
import { ConflictError } from "@/src/domain/errors/ConflictError";
import type {
  IPaymentAttemptRepository,
  NewPaymentAttempt,
  PaymentAttemptResult,
} from "@/src/domain/repositories/IPaymentAttemptRepository";
import { prisma } from "@/src/infrastructure/prisma/client";

import { inTransaction, type PrismaDb } from "../prisma/transaction";

/**
 * Payment attempts in PostgreSQL. Every state change is a guarded `updateMany` on
 * the status it expects, so concurrent callbacks can't both move the same attempt;
 * `live_order_id` (unique, set only while an attempt is live) keeps one live
 * attempt per order, and CHECK constraints in the migration back both rules up.
 */
export class PrismaPaymentAttemptRepository implements IPaymentAttemptRepository {
  constructor(private readonly db: PrismaDb = prisma) {}

  async open(input: NewPaymentAttempt): Promise<PaymentAttempt> {
    try {
      return await inTransaction(this.db, async (tx) => {
        const verifying = await tx.paymentAttempt.findFirst({ where: { orderId: input.orderId, status: "verifying" }, select: { id: true } });
        if (verifying) throw inProgress();
        await tx.paymentAttempt.updateMany({
          where: { orderId: input.orderId, status: "pending" },
          data: { status: "failed", failureReason: "superseded", liveOrderId: null },
        });
        return toPaymentAttempt(await tx.paymentAttempt.create({ data: { ...input, status: "pending", liveOrderId: input.orderId } }));
      });
    } catch (error) {
      // A concurrent open — or a claim between the check and the insert — holds the live slot.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw inProgress(error);
      throw error;
    }
  }

  async getByAuthority(authority: string): Promise<PaymentAttempt | null> {
    const row = await this.db.paymentAttempt.findUnique({ where: { authority } });
    return row ? toPaymentAttempt(row) : null;
  }

  async claim(id: string, staleBefore: Date): Promise<PaymentAttempt | null> {
    const result = await this.db.paymentAttempt.updateMany({
      where: { id, OR: [{ status: "pending" }, { status: "verifying", updatedAt: { lt: staleBefore } }] },
      data: { status: "verifying" },
    });
    if (result.count === 0) return null;
    const row = await this.db.paymentAttempt.findUnique({ where: { id } });
    return row ? toPaymentAttempt(row) : null;
  }

  async release(id: string, captured?: { refId: string; cardPan?: string }): Promise<void> {
    await this.db.paymentAttempt.updateMany({
      where: { id, status: "verifying" },
      data: { status: "pending", ...(captured ? { refId: captured.refId, cardPan: captured.cardPan ?? null } : {}) },
    });
  }

  async finish(id: string, result: PaymentAttemptResult): Promise<PaymentAttempt> {
    const data: Prisma.PaymentAttemptUpdateManyMutationInput =
      result.status === "failed"
        ? { status: "failed", failureReason: result.failureReason, gatewayCode: result.gatewayCode ?? null, liveOrderId: null }
        : { status: result.status, refId: result.refId, cardPan: result.cardPan ?? null, liveOrderId: null };
    // Guarded on the claim; if a stale take-over finished it first, its result stands.
    await this.db.paymentAttempt.updateMany({ where: { id, status: "verifying" }, data });
    return toPaymentAttempt(await this.db.paymentAttempt.findUniqueOrThrow({ where: { id } }));
  }
}

function inProgress(cause?: unknown): ConflictError {
  return new ConflictError("PAYMENT_IN_PROGRESS", "A payment for this order is being confirmed.", { cause });
}

function toStatus(value: string): PaymentAttemptStatus {
  return (PAYMENT_ATTEMPT_STATUSES as readonly string[]).includes(value) ? (value as PaymentAttemptStatus) : "failed";
}

function toFailureReason(value: string | null): PaymentFailureReason | undefined {
  return value && (PAYMENT_FAILURE_REASONS as readonly string[]).includes(value) ? (value as PaymentFailureReason) : undefined;
}

function toPaymentAttempt(row: PaymentAttemptRow): PaymentAttempt {
  return {
    id: row.id,
    orderId: row.orderId,
    provider: row.provider,
    authority: row.authority,
    amount: row.amount,
    status: toStatus(row.status),
    failureReason: toFailureReason(row.failureReason),
    gatewayCode: row.gatewayCode ?? undefined,
    refId: row.refId ?? undefined,
    cardPan: row.cardPan ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
