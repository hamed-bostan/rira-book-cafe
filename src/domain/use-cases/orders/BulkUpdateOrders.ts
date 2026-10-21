import { MAX_BULK_ORDERS, canApplyBulkOrderAction, type Order, type PaymentMethod } from "../../entities/Order";
import { ConflictError } from "../../errors/ConflictError";
import { InvalidOrderTransitionError } from "../../errors/InvalidOrderTransitionError";
import { NotFoundError } from "../../errors/NotFoundError";
import { ValidationError } from "../../errors/ValidationError";

import { ChangeOrderStatus } from "./ChangeOrderStatus";
import { SetOrderPayment } from "./SetOrderPayment";

import type { ActivityActor } from "../../entities/ActivityEntry";
import type { ICustomerNotifier } from "../../repositories/INotificationRepository";
import type { IOrderRepository } from "../../repositories/IOrderRepository";

/** One action applied to every order in a selection. */
export type BulkOrderChange =
  { type: "serve" } | { type: "markPaid"; paymentMethod: PaymentMethod } | { type: "cancel" };

/**
 * Apply one action to a selection of orders from the dashboard list — serve them,
 * record their payment, or cancel them.
 *
 * Each order goes through the same use-case its own detail screen uses, so a bulk
 * change is audited, booked, stocked and notified exactly like a single one. That
 * also means each order is its own transaction: a selection is a convenience, not
 * a unit, and one order that lost a race shouldn't hold back the other eleven.
 *
 * Orders the action doesn't fit (a served order in a "cancel" selection), ids that
 * no longer exist, and orders someone else moved in the meantime are skipped. The
 * returned list is what actually changed, and its length is what the screen reports.
 */
export class BulkUpdateOrders {
  constructor(
    private readonly orderRepo: IOrderRepository,
    private readonly notifier?: ICustomerNotifier,
  ) {}

  async execute(ids: readonly string[], change: BulkOrderChange, actor: ActivityActor): Promise<Order[]> {
    if (ids.length === 0) throw new ValidationError("ids", "Select at least one order.");
    if (ids.length > MAX_BULK_ORDERS) throw new ValidationError("ids", `Select at most ${MAX_BULK_ORDERS} orders.`);

    const changeStatus = new ChangeOrderStatus(this.orderRepo, this.notifier);
    const setPayment = new SetOrderPayment(this.orderRepo);
    const updated: Order[] = [];

    // One at a time, on purpose: every write takes stock and posts to the ledger,
    // and running a hundred of those at once would only contend for the same rows.
    for (const id of new Set(ids)) {
      const order = await this.orderRepo.getById(id);
      if (!order || !canApplyBulkOrderAction(order, change.type)) continue;

      try {
        updated.push(
          change.type === "markPaid"
            ? await setPayment.execute(id, "paid", change.paymentMethod, actor)
            : await changeStatus.execute(id, change.type === "serve" ? "completed" : "cancelled", actor),
        );
      } catch (error) {
        // Moved or removed by someone else between the read above and the write.
        if (
          error instanceof InvalidOrderTransitionError ||
          error instanceof ConflictError ||
          error instanceof NotFoundError
        ) {
          continue;
        }
        throw error;
      }
    }

    return updated;
  }
}
