import { singleChange, type ActivityActor } from "../../entities/ActivityEntry";
import { canMarkAttemptRefunded, type OrderPaymentAttempt } from "../../entities/PaymentAttempt";
import { ConflictError } from "../../errors/ConflictError";
import { NotFoundError } from "../../errors/NotFoundError";

import type { IPaymentAttemptRepository } from "../../repositories/IPaymentAttemptRepository";

/**
 * Online payments the gateway captured but no order could take: the guest paid
 * at the gateway while staff marked the order paid at the counter, or cancelled
 * it, and the callback lost that race (see `VerifyOnlinePayment`). The money sits
 * with the gateway until someone gives it back from the gateway's panel — these
 * list what's still owed back, and record that it was.
 *
 * The books never saw an unapplied payment (the callback books only a payment the
 * order took), so giving one back books nothing either: it left the way it came.
 */

/** Every payment still to give back, oldest first — the Orders list's warning. Anyone with the dashboard may read it. */
export class ListUnappliedPayments {
  constructor(private readonly attempts: IPaymentAttemptRepository) {}

  execute(): Promise<OrderPaymentAttempt[]> {
    return this.attempts.listUnapplied();
  }
}

/** One order's payments it didn't take, still to give back or given back — for its page. */
export class ListOrderUnappliedPayments {
  constructor(private readonly attempts: IPaymentAttemptRepository) {}

  execute(orderId: string): Promise<OrderPaymentAttempt[]> {
    return this.attempts.listUnappliedForOrder(orderId);
  }
}

/**
 * Staff gave an unapplied payment back in the gateway's panel: mark it `refunded`,
 * so it leaves the list, and log who said so on the order's history. Only once:
 * a second mark (or one racing it) is a `ConflictError`.
 */
export class MarkPaymentRefunded {
  constructor(private readonly attempts: IPaymentAttemptRepository) {}

  async execute(attemptId: string, actor: ActivityActor): Promise<OrderPaymentAttempt> {
    const attempt = await this.attempts.getById(attemptId);
    if (!attempt) throw new NotFoundError("payment", attemptId);
    if (!canMarkAttemptRefunded(attempt)) {
      throw new ConflictError("INVALID_TRANSITION", "That payment isn't waiting to be given back.");
    }

    return this.attempts.markRefunded(attemptId, (saved) => ({
      actorId: actor.id,
      actorName: actor.name,
      action: "order.onlinePaymentRefunded",
      entityType: "order",
      entityId: saved.orderId,
      entityLabel: `#${saved.orderNumber}`,
      changes: [...singleChange("amount", null, saved.amount), ...singleChange("refId", null, saved.refId ?? null)],
    }));
  }
}
