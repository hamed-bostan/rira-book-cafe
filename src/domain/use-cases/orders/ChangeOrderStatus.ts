import { singleChange, type ActivityActor } from "../../entities/ActivityEntry";
import { canTransition, isGuestCancellable, type Order, type OrderStatus } from "../../entities/Order";
import { InvalidOrderTransitionError } from "../../errors/InvalidOrderTransitionError";
import { NotFoundError } from "../../errors/NotFoundError";

import type { IOrderRepository } from "../../repositories/IOrderRepository";

/**
 * Move an order along the workflow on behalf of staff — accept, start preparing,
 * mark ready, complete, or cancel.
 *
 * The workflow table in `Order.ts` is the whole rule; this checks it against the
 * order as it stands and hands the repository the status it read, so a change
 * made by someone else in the meantime fails rather than being overwritten.
 */
export class ChangeOrderStatus {
  constructor(private readonly orderRepo: IOrderRepository) {}

  async execute(orderId: string, to: OrderStatus, actor: ActivityActor): Promise<Order> {
    const order = await this.orderRepo.getById(orderId);
    if (!order) throw new NotFoundError("order", orderId);
    if (!canTransition(order.status, to)) throw new InvalidOrderTransitionError(order.status, to);

    return this.orderRepo.transition(orderId, order.status, to, actor, (saved) => ({
      actorId: actor.id,
      actorName: actor.name,
      action: "order.stageChanged",
      entityType: "order",
      entityId: saved.id,
      entityLabel: `#${saved.orderNumber}`,
      changes: singleChange("status", order.status, saved.status),
    }));
  }
}

/**
 * A guest withdrawing their own order. Only their own, and only while it's still
 * `pending` — once staff have accepted it, cancelling is a conversation at the
 * counter. An order that isn't theirs reads as not found, so ids can't be probed.
 */
export class CancelOwnOrder {
  constructor(private readonly orderRepo: IOrderRepository) {}

  async execute(orderId: string, guest: ActivityActor): Promise<Order> {
    const order = await this.orderRepo.getById(orderId);
    if (order?.userId !== guest.id) throw new NotFoundError("order", orderId);
    if (!isGuestCancellable(order.status)) throw new InvalidOrderTransitionError(order.status, "cancelled");

    return this.orderRepo.transition(orderId, order.status, "cancelled", guest);
  }
}
