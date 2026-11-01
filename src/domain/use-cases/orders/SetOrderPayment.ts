import { singleChange, type ActivityActor } from "../../entities/ActivityEntry";
import {
  largestPaymentPart,
  paymentPartsProblem,
  type Order,
  type PaymentMethod,
  type PaymentPart,
  type SettablePaymentStatus,
} from "../../entities/Order";
import { ConflictError } from "../../errors/ConflictError";
import { NotFoundError } from "../../errors/NotFoundError";
import { ValidationError } from "../../errors/ValidationError";

import { paymentPostings } from "./orderLedger";

import type { IOrderRepository } from "../../repositories/IOrderRepository";

/**
 * Record that a guest paid — and how — or undo a mistaken mark. Allowed in any
 * live status (a guest may pay before or after they're served), audited, and
 * booked: paying posts the money into each part's account, unmarking reverses it.
 * A bill paid one way takes the method; a split bill takes its parts, which must
 * add up to the total.
 *
 * A cancelled order can't be marked paid (there's nothing to pay for) and a
 * refunded one is settled for good. Neither can a payment be taken back once part
 * of it was refunded: the refund is on the books against it. Setting the status it
 * already has is a no-op — unless `strict`, for a caller that must know its own
 * mark took effect (an online payment the gateway captured): then it's a
 * `ConflictError` instead.
 */
export class SetOrderPayment {
  constructor(private readonly orderRepo: IOrderRepository) {}

  async execute(
    orderId: string,
    paymentStatus: SettablePaymentStatus,
    payment: PaymentMethod | readonly PaymentPart[] | undefined,
    actor: ActivityActor,
    options: { strict?: boolean } = {},
  ): Promise<Order> {
    const order = await this.orderRepo.getById(orderId);
    if (!order) throw new NotFoundError("order", orderId);
    if (order.paymentStatus === paymentStatus) {
      if (options.strict)
        throw new ConflictError("INVALID_TRANSITION", `The payment is already ${order.paymentStatus}.`);
      return order;
    }
    if (order.paymentStatus === "refunded") {
      throw new ConflictError("INVALID_TRANSITION", "A refunded order's payment can't be changed.");
    }
    if (order.refundedTotal > 0) {
      throw new ConflictError("INVALID_TRANSITION", "Part of this payment was refunded, so it can't be taken back.");
    }
    if (paymentStatus === "paid" && order.status === "cancelled") {
      throw new ConflictError("INVALID_TRANSITION", "A cancelled order can't be marked paid.");
    }
    if (paymentStatus === "paid" && !payment) throw new ValidationError("paymentMethod", "Choose how the guest paid.");
    const parts = paymentStatus === "paid" ? partsFor(payment, order.total) : undefined;

    return this.orderRepo.setPaymentStatus(
      orderId,
      { from: order.paymentStatus, to: paymentStatus, parts },
      (saved) => ({
        actorId: actor.id,
        actorName: actor.name,
        action: "order.paymentChanged",
        entityType: "order",
        entityId: saved.id,
        entityLabel: `#${saved.orderNumber}`,
        changes: [
          ...singleChange("paymentStatus", order.paymentStatus, saved.paymentStatus),
          ...(order.paymentMethod === saved.paymentMethod
            ? []
            : singleChange("paymentMethod", order.paymentMethod ?? null, saved.paymentMethod ?? null)),
        ],
      }),
      paymentPostings(order, actor),
    );
  }
}

/** One method pays the whole total; a split must add up to it. */
function partsFor(payment: PaymentMethod | readonly PaymentPart[] | undefined, total: number): PaymentPart[] {
  if (payment === undefined) return [];
  if (typeof payment === "string") return [{ method: payment, amount: total }];
  const problem = paymentPartsProblem(payment, total);
  if (problem) throw new ValidationError("paymentParts", problem);
  // Largest first: the order's method is the part most of the money came in by.
  const largest = largestPaymentPart(payment);
  return [largest, ...payment.filter((part) => part !== largest)];
}
