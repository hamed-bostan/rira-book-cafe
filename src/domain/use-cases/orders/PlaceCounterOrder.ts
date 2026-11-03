import { singleChange, type ActivityActor } from "../../entities/ActivityEntry";
import {
  MAX_COUNTER_CUSTOMER_LENGTH,
  MAX_ORDER_NOTE_TEXT_LENGTH,
  MAX_TABLE_LABEL_LENGTH,
  orderSubtotal,
  paymentPartsProblem,
  type Order,
  type PaymentPart,
  type ServiceType,
} from "../../entities/Order";
import { ValidationError } from "../../errors/ValidationError";

import { ChangeOrderStatus } from "./ChangeOrderStatus";
import { buildOrderLines, type PlaceOrderInput } from "./PlaceOrder";
import { SetOrderPayment } from "./SetOrderPayment";

import type { IOrderRepository } from "../../repositories/IOrderRepository";
import type { IProductRepository } from "../../repositories/IProductRepository";

export type CounterOrderInput = {
  items: PlaceOrderInput["items"];
  serviceType: ServiceType;
  tableLabel?: string;
  note?: string;
  /** Who it's for: a typed name, or the default for a walk-in. */
  customerName: string;
  customerPhone?: string;
  /** How the guest paid, when they paid at the counter; omitted leaves the order to pay later. */
  paymentParts?: readonly PaymentPart[];
  /** Handed over on the spot, so it skips the bar's queue. */
  complete?: boolean;
};

/**
 * Ring up a sale at the counter: a walk-in who has no account, a phone order, a book
 * picked off the shelf. Prices come from the menu, like a guest's order, and it takes
 * units off the shelf the same way, but it belongs to no account — so it earns no
 * points, and promo codes (which are counted per guest) don't apply. Handed over on
 * the spot, it tells nobody; one left in the queue is told how it goes by the phone
 * it was rung up with, like any order (`orderStatusNotification`).
 *
 * Paying and completing go through the same use-cases staff use on the order, so
 * the money and the sale are audited, stocked and booked exactly the same. They run
 * after the order is placed, each in its own transaction: if one fails, the order
 * still stands and staff can finish it from its page.
 */
export class PlaceCounterOrder {
  constructor(
    private readonly orderRepo: IOrderRepository,
    private readonly productRepo: Pick<IProductRepository, "getByIds">,
  ) {}

  async execute(input: CounterOrderInput, staff: ActivityActor): Promise<Order> {
    const customerName = input.customerName.trim();
    if (!customerName) throw new ValidationError("customerName", "Enter a name for the sale.");
    if (customerName.length > MAX_COUNTER_CUSTOMER_LENGTH) {
      throw new ValidationError("customerName", "That name is too long.");
    }
    const tableLabel = input.tableLabel?.trim() || undefined;
    if (input.serviceType === "dineIn" && !tableLabel) {
      throw new ValidationError("tableLabel", "Choose a table for a dine-in order.");
    }
    if (tableLabel && tableLabel.length > MAX_TABLE_LABEL_LENGTH) {
      throw new ValidationError("tableLabel", "That table label is too long.");
    }
    const note = input.note?.trim() || undefined;
    if (note && note.length > MAX_ORDER_NOTE_TEXT_LENGTH) throw new ValidationError("note", "That note is too long.");

    const items = await buildOrderLines(this.productRepo, input.items);
    const subtotal = orderSubtotal(items);
    // Checked before anything is placed: a wrong split shouldn't leave an order behind.
    const problem = input.paymentParts ? paymentPartsProblem(input.paymentParts, subtotal) : null;
    if (problem) throw new ValidationError("paymentParts", problem);

    const placed = await this.orderRepo.place(
      {
        customerName,
        customerPhone: input.customerPhone?.trim() ?? "",
        serviceType: input.serviceType,
        tableLabel: input.serviceType === "dineIn" ? tableLabel : undefined,
        note,
        items,
        subtotal,
        promoDiscount: 0,
        pointsRedeemed: 0,
        pointsDiscount: 0,
        total: subtotal,
      },
      staff,
      (order) => ({
        actorId: staff.id,
        actorName: staff.name,
        action: "order.counterSale",
        entityType: "order",
        entityId: order.id,
        entityLabel: `#${order.orderNumber}`,
        changes: singleChange("total", null, order.total),
      }),
    );

    let order = placed;
    if (input.paymentParts) {
      order = await new SetOrderPayment(this.orderRepo).execute(order.id, "paid", input.paymentParts, staff);
    }
    if (input.complete) {
      const changeStatus = new ChangeOrderStatus(this.orderRepo);
      await changeStatus.execute(order.id, "preparing", staff);
      order = await changeStatus.execute(order.id, "completed", staff);
    }
    return order;
  }
}
