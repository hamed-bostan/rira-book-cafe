import { singleChange, type ActivityActor } from "../../entities/ActivityEntry";
import {
  MAX_ORDER_NOTE_TEXT_LENGTH,
  MAX_TABLE_LABEL_LENGTH,
  orderSubtotal,
  paymentPartsProblem,
  type Order,
  type PaymentPart,
  type ServiceType,
} from "../../entities/Order";
import { ValidationError } from "../../errors/ValidationError";
import { ResolveGuestProfile } from "../guest-profiles/ResolveGuestProfile";

import { ChangeOrderStatus } from "./ChangeOrderStatus";
import { buildOrderLines, type PlaceOrderInput } from "./PlaceOrder";
import { SetOrderPayment } from "./SetOrderPayment";

import type { IOrderRepository } from "../../repositories/IOrderRepository";
import type { IProductRepository } from "../../repositories/IProductRepository";
import type { IUserRepository } from "../../repositories/IUserRepository";

export type CounterOrderInput = {
  items: PlaceOrderInput["items"];
  serviceType: ServiceType;
  tableLabel?: string;
  note?: string;
  /** The guest's phone: every sale is a guest's. */
  customerPhone: string;
  /** The guest's name, for a phone with no profile yet (see `ResolveGuestProfile`). */
  customerName?: string;
  /** How the guest paid, when they paid at the counter; omitted leaves the order to pay later. */
  paymentParts?: readonly PaymentPart[];
  /** Handed over on the spot, so it skips the bar's queue. */
  complete?: boolean;
};

/**
 * Ring up a sale at the counter: a walk-in, a phone order, a book picked off the
 * shelf. Prices come from the menu, like a guest's order, and it takes units off
 * the shelf the same way. It's rung up for the guest's profile, found by the phone
 * they give (or made with the sale, from their name, when the phone has none), so
 * it's in their orders when they sign in and earns them points when it's completed,
 * as any member's order does. Promo codes and points aren't spent at the counter.
 * Handed over on the spot, it tells nobody; one left in the queue tells the guest
 * how it goes, like any order (`orderStatusNotification`).
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
    private readonly userRepo: Pick<IUserRepository, "getById">,
  ) {}

  async execute(input: CounterOrderInput, staff: ActivityActor): Promise<Order> {
    const tableLabel = input.tableLabel?.trim() || undefined;
    if (input.serviceType === "dineIn" && !tableLabel) {
      throw new ValidationError("tableLabel", "Choose a table for a dine-in order.");
    }
    if (tableLabel && tableLabel.length > MAX_TABLE_LABEL_LENGTH) {
      throw new ValidationError("tableLabel", "That table label is too long.");
    }
    const note = input.note?.trim() || undefined;
    if (note && note.length > MAX_ORDER_NOTE_TEXT_LENGTH) throw new ValidationError("note", "That note is too long.");
    const guest = await new ResolveGuestProfile(this.userRepo).execute(
      { phone: input.customerPhone, name: input.customerName },
      staff,
      { phone: "customerPhone", name: "customerName" },
    );

    const items = await buildOrderLines(this.productRepo, input.items);
    const subtotal = orderSubtotal(items);
    // Checked before anything is placed: a wrong split shouldn't leave an order behind.
    const problem = input.paymentParts ? paymentPartsProblem(input.paymentParts, subtotal) : null;
    if (problem) throw new ValidationError("paymentParts", problem);

    const placed = await this.orderRepo.place(
      {
        userId: guest.userId,
        newGuest: guest.newProfile,
        customerName: guest.name,
        customerPhone: guest.phone,
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
