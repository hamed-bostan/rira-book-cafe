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

import type { ActivityActor } from "../../entities/ActivityEntry";
import type { User } from "../../entities/User";
import type { IOrderRepository } from "../../repositories/IOrderRepository";
import type { IProductRepository } from "../../repositories/IProductRepository";

/** What the guest asks for. Prices and names come from the menu, never from the client. */
export type PlaceOrderInput = {
  items: { productId: string; quantity: number; note?: string }[];
  serviceType: ServiceType;
  tableLabel?: string;
  note?: string;
};

/**
 * Place an order for a signed-in guest.
 *
 * The client sends only *which* items and how many; every price, name and image is
 * read from the menu here and snapshotted onto the order, so a tampered request
 * can't name its own price. Items that aren't on the public menu — unpublished,
 * deleted, or a reading-only book — are refused.
 */
export class PlaceOrder {
  constructor(
    private readonly orderRepo: IOrderRepository,
    private readonly productRepo: IProductRepository,
  ) {}

  async execute(input: PlaceOrderInput, guest: Pick<User, "id" | "name" | "phone">): Promise<Order> {
    if (input.items.length === 0) throw new ValidationError("items", "An order needs at least one item.");

    const tableLabel = input.tableLabel?.trim() || undefined;
    if (input.serviceType === "dineIn" && !tableLabel) {
      throw new ValidationError("tableLabel", "Choose a table for a dine-in order.");
    }
    if (tableLabel && tableLabel.length > MAX_TABLE_LABEL_LENGTH) {
      throw new ValidationError("tableLabel", "That table label is too long.");
    }
    const note = input.note?.trim() || undefined;
    if (note && note.length > MAX_ORDER_NOTE_TEXT_LENGTH) throw new ValidationError("note", "That note is too long.");

    for (const line of input.items) {
      if (!Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > MAX_LINE_QUANTITY) {
        throw new ValidationError("items", `Quantities must be whole numbers from 1 to ${MAX_LINE_QUANTITY}.`);
      }
    }

    const ids = [...new Set(input.items.map((line) => line.productId))];
    const products = await this.productRepo.getByIds(ids);
    const byId = new Map(products.map((product) => [product.id, product]));

    const items: Omit<OrderItem, "id">[] = input.items.map((line) => {
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
        quantity: line.quantity,
        note: lineNote,
      };
    });

    const subtotal = orderSubtotal(items);
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
        total: subtotal,
      },
      actor,
    );
  }
}
