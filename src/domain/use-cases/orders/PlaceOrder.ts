import {
  MAX_LINE_QUANTITY,
  MAX_ORDER_AMOUNT,
  MAX_ORDER_NOTE_TEXT_LENGTH,
  MAX_TABLE_LABEL_LENGTH,
  orderSubtotal,
  type Order,
  type OrderItem,
  type ServiceType,
} from "../../entities/Order";
import { isOnPublicMenu, isSellable } from "../../entities/Product";
import {
  optionSelectionProblem,
  optionsDelta,
  snapshotOptions,
  withDefaultChoices,
  type OrderItemOption,
  type ProductOptionGroup,
} from "../../entities/ProductOptions";
import { ValidationError } from "../../errors/ValidationError";
import { categoryLookup, type MenuCatalog } from "../products/publicMenu";

import { CheckoutPricing, checkoutLines } from "./CheckoutPricing";

import type { ActivityActor } from "../../entities/ActivityEntry";
import type { OrderQuote } from "../../entities/Checkout";
import type { User } from "../../entities/User";
import type { IOrderRepository } from "../../repositories/IOrderRepository";

/**
 * One line as a client asks for it: which item, how many, the guest's note, and
 * the ids of the options chosen (see `ProductOptions`) — never a price.
 */
type OrderLineRequest = { productId: string; quantity: number; note?: string; choiceIds?: readonly string[] };

/**
 * The options a line asked for, checked against the item's options as they are
 * now, and snapshotted. A required single-choice group the request left out gets
 * its default (a basket filled before the item had options still orders); anything
 * else wrong — a choice the item doesn't have (any more), one switched off, a
 * required group unanswered, too few or too many — refuses the order, with the
 * reason as a `formErrors` key.
 */
function lineOptions(groups: readonly ProductOptionGroup[], choiceIds: readonly string[]): OrderItemOption[] {
  if (groups.length === 0 && choiceIds.length === 0) return [];
  const chosen = withDefaultChoices(groups, choiceIds);
  const problem = optionSelectionProblem(groups, chosen);
  if (problem) throw new ValidationError("items", problem);
  return snapshotOptions(groups, chosen);
}

/** What the guest asks for. Prices and names come from the menu, never from the client. */
export type PlaceOrderInput = {
  items: OrderLineRequest[];
  serviceType: ServiceType;
  tableLabel?: string;
  note?: string;
  /** A promo code as typed; blank = none. */
  promoCode?: string;
  /** Spend as many loyalty points as the order allows. */
  redeemPoints?: boolean;
};

/**
 * What the basket asks to preview: the lines and the discounts — and how it's
 * served, when the guest has said, since a dine-in order carries the service charge.
 */
export type QuoteOrderInput = Pick<PlaceOrderInput, "items" | "promoCode" | "redeemPoints"> &
  Partial<Pick<PlaceOrderInput, "serviceType">>;

/**
 * Price the requested lines from the menu, snapshotting each item's name, image,
 * price and cost. Items that aren't on the public menu — unpublished, in a hidden
 * category, deleted, or a reading-only book — are refused.
 *
 * Every way an order gets lines comes through here — a guest's order and its quote,
 * a counter sale, lines staff add to an order — so staff can't ring up an item
 * guests can't order either: their picker is the public menu (see `isOnPublicMenu`).
 */
export async function buildOrderLines(
  menu: MenuCatalog,
  lines: readonly OrderLineRequest[],
): Promise<Omit<OrderItem, "id">[]> {
  if (lines.length === 0) throw new ValidationError("items", "An order needs at least one item.");
  for (const line of lines) {
    if (!Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > MAX_LINE_QUANTITY) {
      throw new ValidationError("items", `Quantities must be whole numbers from 1 to ${MAX_LINE_QUANTITY}.`);
    }
  }

  const ids = [...new Set(lines.map((line) => line.productId))];
  const [products, categoryOf] = await Promise.all([menu.products.getByIds(ids), categoryLookup(menu.categories)]);
  const byId = new Map(products.map((product) => [product.id, product]));

  const items = lines.map((line) => {
    const product = byId.get(line.productId);
    if (!product || !isOnPublicMenu(product, categoryOf(product.categoryId)) || !isSellable(product)) {
      throw new ValidationError("items", "One of the items is no longer on the menu.");
    }
    const lineNote = line.note?.trim() || undefined;
    if (lineNote && lineNote.length > MAX_ORDER_NOTE_TEXT_LENGTH) {
      throw new ValidationError("items", "An item note is too long.");
    }
    const options = lineOptions(product.optionGroups ?? [], line.choiceIds ?? []);
    return {
      productId: product.id,
      kind: product.kind,
      name: product.name,
      imageUrl: product.imageUrl,
      // The item's price as it is now, plus what each choice adds now — never the
      // client's figure. Discounts (promo, points) then apply to these lines' totals.
      unitPrice: product.price + optionsDelta(options),
      ...(options.length > 0 ? { options } : {}),
      // Snapshotted like the price, so a later cost change doesn't rewrite past margins.
      unitCost: product.costPrice,
      taxExempt: product.taxExempt,
      quantity: line.quantity,
      note: lineNote,
    };
  });
  // Every amount on an order (discounts, payments, refunds) is at most its subtotal.
  if (orderSubtotal(items) > MAX_ORDER_AMOUNT) {
    throw new ValidationError("items", "That's more than one order can hold — split it into two.");
  }
  return items;
}

/**
 * Preview what the basket will cost with a promo code and/or points — the same
 * pricing the order will get, so the guest sees the real total before placing it.
 */
export class QuoteOrder {
  constructor(
    private readonly menu: MenuCatalog,
    private readonly pricing: CheckoutPricing,
  ) {}

  async execute(input: QuoteOrderInput, guestId: string | null, now: Date): Promise<OrderQuote> {
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
 * Place an order for a signed-in guest.
 *
 * The client sends only *which* items and how many; every price, name and image is
 * read from the menu here and snapshotted onto the order, so a tampered request
 * can't name its own price — nor its own discount: the promo code and points are
 * priced here too (see `CheckoutPricing`).
 */
export class PlaceOrder {
  constructor(
    private readonly orderRepo: IOrderRepository,
    private readonly menu: MenuCatalog,
    private readonly pricing: CheckoutPricing = new CheckoutPricing(),
  ) {}

  async execute(
    input: PlaceOrderInput,
    guest: Pick<User, "id" | "name" | "phone">,
    now: Date = new Date(),
  ): Promise<Order> {
    const tableLabel = input.tableLabel?.trim() || undefined;
    if (input.serviceType === "dineIn" && !tableLabel) {
      throw new ValidationError("tableLabel", "Choose a table for a dine-in order.");
    }
    if (tableLabel && tableLabel.length > MAX_TABLE_LABEL_LENGTH) {
      throw new ValidationError("tableLabel", "That table label is too long.");
    }
    const note = input.note?.trim() || undefined;
    if (note && note.length > MAX_ORDER_NOTE_TEXT_LENGTH) throw new ValidationError("note", "That note is too long.");

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
      guest.id,
      now,
    );
    const actor: ActivityActor = { id: guest.id, name: guest.name };

    return this.orderRepo.place(
      {
        userId: guest.id,
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
      actor,
    );
  }
}
