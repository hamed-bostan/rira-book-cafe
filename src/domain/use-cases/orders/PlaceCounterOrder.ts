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
import { isPlausiblePhone, normalizePhone } from "../../entities/Phone";
import { ValidationError } from "../../errors/ValidationError";
import { ResolveGuestProfile } from "../guest-profiles/ResolveGuestProfile";

import { ChangeOrderStatus } from "./ChangeOrderStatus";
import { CheckoutPricing, checkoutLines } from "./CheckoutPricing";
import { buildOrderLines, type PlaceOrderInput } from "./PlaceOrder";
import { SetOrderPayment } from "./SetOrderPayment";

import type { OrderQuote } from "../../entities/Checkout";
import type { IOrderRepository } from "../../repositories/IOrderRepository";
import type { IUserRepository } from "../../repositories/IUserRepository";
import type { MenuCatalog } from "../products/publicMenu";

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
  /** A promo code the guest gave, as typed; blank = none. */
  promoCode?: string;
  /** Spend as many of the guest's points as the order allows. */
  redeemPoints?: boolean;
};

/** What the counter asks to preview: the sale's lines, service and discounts, and the guest's phone once typed. */
export type CounterQuoteInput = Pick<CounterOrderInput, "items" | "serviceType" | "promoCode" | "redeemPoints"> & {
  customerPhone?: string;
};

/**
 * Preview what a counter sale will cost — the same `CheckoutPricing` the guest's
 * basket and the sale itself use, so the total staff take payment for is the total
 * charged. The guest is read by phone, as the sale will be (a profile's id is its
 * normalized phone): one with no profile yet is a new guest with no points and no
 * uses; no usable phone yet prices the sale for no guest, so a code with a per-guest
 * rule says it needs one.
 */
export class QuoteCounterOrder {
  constructor(
    private readonly menu: MenuCatalog,
    private readonly pricing: CheckoutPricing,
  ) {}

  async execute(input: CounterQuoteInput, now: Date = new Date()): Promise<OrderQuote> {
    const phone = input.customerPhone?.trim() ?? "";
    const guestId = phone && isPlausiblePhone(phone) ? normalizePhone(phone) : null;
    const items = await buildOrderLines(this.menu, input.items);
    const { promo: _promo, ...quote } = await this.pricing.execute(
      {
        subtotal: orderSubtotal(items),
        lines: checkoutLines(items),
        promoCode: input.promoCode,
        redeemPoints: input.redeemPoints,
        serviceType: input.serviceType,
      },
      guestId,
      now,
    );
    return quote;
  }
}

/**
 * Ring up a sale at the counter: a walk-in, a phone order, a book picked off the
 * shelf. Prices come from the menu, like a guest's order, and it takes units off
 * the shelf the same way. Only what guests could order can be rung up: an item that
 * is unpublished, or in a category staff hid, is off the counter's picker too, and
 * refused here (`isOnPublicMenu`, via `buildOrderLines`). It's rung up for the guest's profile, found by the phone
 * they give (or made with the sale, from their name, when the phone has none), so
 * it's in their orders when they sign in and earns them points when it's completed,
 * as any member's order does. A promo code and the guest's points are priced
 * exactly as at the guest's own checkout (`CheckoutPricing`), and re-checked under
 * the code's lock and the guest's points lock when the order is placed — the uses and
 * the per-guest limits count against the guest's profile. Handed over on the spot, it tells nobody; one left in the queue tells the guest
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
    private readonly menu: MenuCatalog,
    private readonly userRepo: Pick<IUserRepository, "getById">,
    private readonly pricing: CheckoutPricing = new CheckoutPricing(),
  ) {}

  async execute(input: CounterOrderInput, staff: ActivityActor, now: Date = new Date()): Promise<Order> {
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

    const items = await buildOrderLines(this.menu, input.items);
    const subtotal = orderSubtotal(items);
    const priced = await this.pricing.execute(
      {
        subtotal,
        lines: checkoutLines(items),
        promoCode: input.promoCode,
        redeemPoints: input.redeemPoints,
        serviceType: input.serviceType,
      },
      guest.userId,
      now,
    );
    // Checked before anything is placed: a wrong split shouldn't leave an order behind.
    const problem = input.paymentParts ? paymentPartsProblem(input.paymentParts, priced.total) : null;
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
        promoCodeId: priced.promo?.id,
        promoCode: priced.promo?.code,
        promoDiscount: priced.promoDiscount,
        pointsRedeemed: priced.pointsRedeemed,
        pointsDiscount: priced.pointsDiscount,
        serviceCharge: priced.serviceCharge,
        serviceChargeBps: priced.serviceChargeBps,
        total: priced.total,
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
