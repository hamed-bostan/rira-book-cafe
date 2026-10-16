import { singleChange, type ActivityActor } from "../../entities/ActivityEntry";
import { NotFoundError } from "../../errors/NotFoundError";

import type { Order, PaymentStatus } from "../../entities/Order";
import type { IOrderRepository } from "../../repositories/IOrderRepository";

/**
 * Record that a guest paid at the counter (or undo a mistaken mark). Allowed in
 * any status — a guest may pay before or after they're served — and audited, since
 * it's money. Setting the status it already has is a no-op with no entry.
 */
export class SetOrderPayment {
  constructor(private readonly orderRepo: IOrderRepository) {}

  async execute(orderId: string, paymentStatus: PaymentStatus, actor: ActivityActor): Promise<Order> {
    const order = await this.orderRepo.getById(orderId);
    if (!order) throw new NotFoundError("order", orderId);
    if (order.paymentStatus === paymentStatus) return order;

    return this.orderRepo.setPaymentStatus(orderId, paymentStatus, (saved) => ({
      actorId: actor.id,
      actorName: actor.name,
      action: "order.paymentChanged",
      entityType: "order",
      entityId: saved.id,
      entityLabel: `#${saved.orderNumber}`,
      changes: singleChange("paymentStatus", order.paymentStatus, saved.paymentStatus),
    }));
  }
}
