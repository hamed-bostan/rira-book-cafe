import { canServeItems, type Order } from "../../entities/Order";
import { ConflictError } from "../../errors/ConflictError";
import { NotFoundError } from "../../errors/NotFoundError";

import type { IOrderRepository } from "../../repositories/IOrderRepository";

/**
 * Tick one line of an order off as served — or take a mistaken tick back — so the
 * floor can see what has reached the guest and what is still being made.
 *
 * Only while the order is being worked (`accepted` → `ready`): before that nobody
 * has started on it, and once it's completed everything was served. Not audited:
 * it's the bar's running checklist, not a business change — the order's status
 * history already records who took and finished it. Setting the state a line
 * already has is a no-op, so a double tap is harmless.
 */
export class SetOrderItemServed {
  constructor(private readonly orderRepo: IOrderRepository) {}

  async execute(orderId: string, itemId: string, served: boolean): Promise<Order> {
    const order = await this.orderRepo.getById(orderId);
    if (!order) throw new NotFoundError("order", orderId);
    const item = order.items.find((line) => line.id === itemId);
    if (!item) throw new NotFoundError("orderItem", itemId);
    if (!canServeItems(order.status)) {
      throw new ConflictError("INVALID_TRANSITION", `A ${order.status} order's items can't be marked served.`);
    }
    if (Boolean(item.servedAt) === served) return order;

    return this.orderRepo.setItemServed(orderId, itemId, served);
  }
}
