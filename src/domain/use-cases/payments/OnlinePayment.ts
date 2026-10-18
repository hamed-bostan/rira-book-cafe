import { outcomeOf, isOpenAttempt, type PaymentAttempt, type PaymentOutcome } from "../../entities/PaymentAttempt";
import { ConflictError } from "../../errors/ConflictError";
import { NotFoundError } from "../../errors/NotFoundError";
import { SetOrderPayment } from "../orders/SetOrderPayment";

import type { Order } from "../../entities/Order";
import type { IOrderRepository } from "../../repositories/IOrderRepository";
import type { IPaymentAttemptRepository, PaymentAttemptResult } from "../../repositories/IPaymentAttemptRepository";
import type { IPaymentGateway } from "../../repositories/IPaymentGateway";

/**
 * A verification that has held its claim this long is presumed dead (the request
 * crashed between claiming and finishing) and may be taken over. Comfortably
 * longer than a gateway round trip.
 */
export const STALE_VERIFICATION_MS = 2 * 60 * 1000;

/** Why an order can't be paid online right now, or `null` when it can. */
function notPayableReason(order: Order): string | null {
  if (order.status === "cancelled") return "A cancelled order can't be paid.";
  if (order.paymentStatus !== "unpaid") return `This order is already ${order.paymentStatus}.`;
  if (order.total <= 0) return "There's nothing to pay on this order.";
  return null;
}

/**
 * The guest starts paying one of their own orders online: the gateway opens a
 * payment for the order's total and the attempt is recorded, so the callback can
 * later check it. Returns the gateway page to send the guest to.
 *
 * Someone else's order reads as not found, the same as a missing one.
 */
export class StartOnlinePayment {
  constructor(
    private readonly orders: IOrderRepository,
    private readonly attempts: IPaymentAttemptRepository,
    private readonly gateway: IPaymentGateway,
  ) {}

  async execute(
    orderId: string,
    userId: string,
    callbackUrl: string,
  ): Promise<{ redirectUrl: string; attempt: PaymentAttempt }> {
    const order = await this.orders.getById(orderId);
    if (order?.userId !== userId) throw new NotFoundError("order", orderId);
    const reason = notPayableReason(order);
    if (reason) throw new ConflictError("NOT_PAYABLE", reason);

    const session = await this.gateway.request({
      amount: order.total,
      callbackUrl,
      description: `Order #${order.orderNumber}`,
      mobile: order.customerPhone,
    });
    const attempt = await this.attempts.open({
      orderId: order.id,
      provider: this.gateway.provider,
      authority: session.authority,
      amount: order.total,
    });
    return { redirectUrl: session.redirectUrl, attempt };
  }
}

export type PaymentCallback = {
  /** The order the callback URL was issued for. */
  orderId: string;
  authority: string;
  /** Whether the gateway reported the guest completed payment (`Status=OK`). */
  completed: boolean;
};

/**
 * The guest is back from the gateway: verify the payment and, only when the
 * gateway confirms it for exactly the attempt's amount, mark the order paid with
 * method `online` — through `SetOrderPayment`, so the ledger posting (Dr Gateway
 * clearing / Cr Guest receivables) is the same one a staff mark makes.
 *
 * Idempotent: an attempt that already finished just reports how it ended, and a
 * claim makes sure two concurrent callbacks verify and book it once. Before
 * verifying, the attempt must still match the order — same total, still unpaid,
 * not cancelled. If it doesn't, the payment is left unverified and the gateway
 * returns the money to the guest by itself.
 */
export class VerifyOnlinePayment {
  constructor(
    private readonly orders: IOrderRepository,
    private readonly attempts: IPaymentAttemptRepository,
    private readonly gateway: IPaymentGateway,
  ) {}

  async execute(callback: PaymentCallback, now: Date = new Date()): Promise<PaymentOutcome> {
    const found = await this.attempts.getByAuthority(callback.authority);
    if (found?.orderId !== callback.orderId) throw new NotFoundError("payment", callback.authority);
    if (!isOpenAttempt(found.status)) return outcomeOf(found);

    const attempt = await this.attempts.claim(found.id, new Date(now.getTime() - STALE_VERIFICATION_MS));
    if (!attempt) {
      // Another request holds it, or finished it a moment ago.
      const current = await this.attempts.getByAuthority(callback.authority);
      return current ? outcomeOf(current) : "processing";
    }

    const finish = async (result: PaymentAttemptResult): Promise<PaymentOutcome> =>
      outcomeOf(await this.attempts.finish(attempt.id, result));
    const order = await this.orders.getById(attempt.orderId);

    // A retry of a callback that captured the money and then failed to book it:
    // the gateway has already said yes, so only the booking is left to do.
    if (attempt.refId) {
      const captured = { refId: attempt.refId, cardPan: attempt.cardPan };
      if (order?.paymentStatus === "paid" && order.paymentMethod === "online") {
        // The booking committed before the failure (one live attempt per order, so it was this one).
        return finish({ status: "paid", ...captured });
      }
      return order ? this.book(attempt, order, captured, finish) : finish({ status: "unapplied", ...captured });
    }

    if (!callback.completed) return finish({ status: "failed", failureReason: "cancelled" });
    if (!order || notPayableReason(order)) return finish({ status: "failed", failureReason: "orderNotPayable" });
    if (order.total !== attempt.amount) return finish({ status: "failed", failureReason: "amountMismatch" });

    let verification;
    try {
      verification = await this.gateway.verify({ authority: attempt.authority, amount: attempt.amount });
    } catch (error) {
      // Nothing was decided — hand the attempt back so a retry can verify it.
      await this.attempts.release(attempt.id);
      throw error;
    }
    if (!verification.ok)
      return finish({ status: "failed", failureReason: "declined", gatewayCode: verification.code });

    return this.book(attempt, order, { refId: verification.refId, cardPan: verification.cardPan }, finish);
  }

  /**
   * The money is captured: mark the order paid — strictly, so a mark that lost a
   * race with a staff "paid" or a cancellation ends `unapplied` (to refund) rather
   * than booking the order's payment twice.
   */
  private async book(
    attempt: PaymentAttempt,
    order: Order,
    captured: { refId: string; cardPan?: string },
    finish: (result: PaymentAttemptResult) => Promise<PaymentOutcome>,
  ): Promise<PaymentOutcome> {
    try {
      await new SetOrderPayment(this.orders).execute(
        order.id,
        "paid",
        "online",
        { id: order.userId, name: order.customerName },
        { strict: true },
      );
    } catch (error) {
      if (error instanceof ConflictError) return finish({ status: "unapplied", ...captured });
      // Keep what the gateway said, so the retry books it without asking again.
      await this.attempts.release(attempt.id, captured);
      throw error;
    }
    return finish({ status: "paid", ...captured });
  }
}
