import {
  MAX_LINE_QUANTITY,
  MAX_ORDER_NOTE_TEXT_LENGTH,
  MAX_TABLE_LABEL_LENGTH,
  orderSubtotal,
  type Order,
  type OrderItem,
  type ServiceType,
} from "../../entities/Order";
import { isSellable } from "../../entities/Product";
import { ValidationError } from "../../errors/ValidationError";

import { CheckoutPricing } from "./CheckoutPricing";

import type { ActivityActor } from "../../entities/ActivityEntry";
import type { OrderQuote } from "../../entities/Checkout";
import type { User } from "../../entities/User";
import type { IOrderRepository } from "../../repositories/IOrderRepository";
import type { IProductRepository } from "../../repositories/IProductRepository";

type OrderLineRequest = { productId: string; quantity: number; note?: string };

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

/** What the basket asks to preview: the lines and the discounts, nothing about service. */
export type QuoteOrderInput = Pick<PlaceOrderInput, "items" | "promoCode" | "redeemPoints">;

/**
 * Price the requested lines from the menu, snapshotting each item's name, image,
 * price and cost. Items that aren't on the public menu — unpublished, deleted, or
 * a reading-only book — are refused.
 */
export async function buildOrderLines(
  productRepo: Pick<IProductRepository, "getByIds">,
  lines: readonly OrderLineRequest[],
): Promise<Omit<OrderItem, "id">[]> {
  if (lines.length === 0) throw new ValidationError("items", "An order needs at least one item.");
  for (const line of lines) {
    if (!Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > MAX_LINE_QUANTITY) {
      throw new ValidationError("items", `Quantities must be whole numbers from 1 to ${MAX_LINE_QUANTITY}.`);
    }
  }

  const ids = [...new Set(lines.map((line) => line.productId))];
  const products = await productRepo.getByIds(ids);
  const byId = new Map(products.map((product) => [product.id, product]));

  return lines.map((line) => {
    const product = byId.get(line.productId);
    if (!product || !product.isPublished || !isSellable(product)) {
      throw new ValidationError("items", "One of the items is no longer on the menu.");
    }
    const lineNote = line.note?.trim() || undefined;
    if (lineNote && lineNote.length > MAX_ORDER_NOTE_TEXT_LENGTH) {
      throw new ValidationError("items", "An item note is too long.");
    }
    return {
      productId: product.id,
      kind: product.kind,
      name: product.name,
      imageUrl: product.imageUrl,
      unitPrice: product.price,
      // Snapshotted like the price, so a later cost change doesn't rewrite past margins.
      unitCost: product.costPrice,
      taxExempt: product.taxExempt,
      quantity: line.quantity,
      note: lineNote,
    };
  });
}

/**
 * Preview what the basket will cost with a promo code and/or points — the same
 * pricing the order will get, so the guest sees the real total before placing it.
 */
export class QuoteOrder {
  constructor(
    private readonly productRepo: Pick<IProductRepository, "getByIds">,
    private readonly pricing: CheckoutPricing,
  ) {}

  async execute(input: QuoteOrderInput, guestId: string, now: Date): Promise<OrderQuote> {
    const items = await buildOrderLines(this.productRepo, input.items);
    const { promo: _promo, ...quote } = await this.pricing.execute(
      { subtotal: orderSubtotal(items), promoCode: input.promoCode, redeemPoints: input.redeemPoints },
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
    private readonly productRepo: Pick<IProductRepository, "getByIds">,
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

    const items = await buildOrderLines(this.productRepo, input.items);
    const subtotal = orderSubtotal(items);
    const priced = await this.pricing.execute(
      { subtotal, promoCode: input.promoCode, redeemPoints: input.redeemPoints },
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
        total: priced.total,
      },
      actor,
    );
  }
}
