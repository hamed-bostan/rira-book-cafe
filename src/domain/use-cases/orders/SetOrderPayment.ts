import { singleChange, type ActivityActor } from "../../entities/ActivityEntry";
import { ConflictError } from "../../errors/ConflictError";
import { NotFoundError } from "../../errors/NotFoundError";
import { ValidationError } from "../../errors/ValidationError";

import { paymentPostings } from "./orderLedger";

import type { Order, PaymentMethod, SettablePaymentStatus } from "../../entities/Order";
import type { IOrderRepository } from "../../repositories/IOrderRepository";

/**
 * Record that a guest paid — and how — or undo a mistaken mark. Allowed in any
 * live status (a guest may pay before or after they're served), audited, and
 * booked: paying posts the money into the method's account, unmarking reverses it.
 *
 * A cancelled order can't be marked paid (there's nothing to pay for) and a
 * refunded one is settled for good. Setting the status it already has is a no-op —
 * unless `strict`, for a caller that must know its own mark took effect (an online
 * payment the gateway captured): then it's a `ConflictError` instead.
 */
export class SetOrderPayment {
  constructor(private readonly orderRepo: IOrderRepository) {}

  async execute(
    orderId: string,
    paymentStatus: SettablePaymentStatus,
    method: PaymentMethod | undefined,
    actor: ActivityActor,
    options: { strict?: boolean } = {},
  ): Promise<Order> {
    const order = await this.orderRepo.getById(orderId);
    if (!order) throw new NotFoundError("order", orderId);
    if (order.paymentStatus === paymentStatus) {
      if (options.strict) throw new ConflictError("INVALID_TRANSITION", `The payment is already ${order.paymentStatus}.`);
      return order;
    }
    if (order.paymentStatus === "refunded") {
      throw new ConflictError("INVALID_TRANSITION", "A refunded order's payment can't be changed.");
    }
    if (paymentStatus === "paid" && order.status === "cancelled") {
      throw new ConflictError("INVALID_TRANSITION", "A cancelled order can't be marked paid.");
    }
    if (paymentStatus === "paid" && !method) throw new ValidationError("paymentMethod", "Choose how the guest paid.");

    return this.orderRepo.setPaymentStatus(
      orderId,
      { from: order.paymentStatus, to: paymentStatus, method },
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
