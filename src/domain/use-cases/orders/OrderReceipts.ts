import { isOrderOf, withoutCosts, type Order } from "../../entities/Order";
import { orderReceipt, type OrderReceipt } from "../../entities/OrderReceipt";

import type { ILedgerRepository } from "../../repositories/ILedgerRepository";
import type { IOrderRepository } from "../../repositories/IOrderRepository";

type ReceiptSources = {
  orders: Pick<IOrderRepository, "getById" | "listRefunds">;
  /** The VAT rate inside menu prices, the one the sale is booked at. */
  ledger: Pick<ILedgerRepository, "getSettings">;
};

async function receiptFor(sources: ReceiptSources, order: Order): Promise<OrderReceipt> {
  const [refunds, settings] = await Promise.all([sources.orders.listRefunds(order.id), sources.ledger.getSettings()]);
  return orderReceipt(order, refunds, settings.vatRateBps);
}

/** Any order's receipt, for staff to print. `null` for an order that doesn't exist. */
export class GetOrderReceipt {
  constructor(private readonly sources: ReceiptSources) {}

  async execute(orderId: string): Promise<OrderReceipt | null> {
    const order = await this.sources.orders.getById(orderId);
    return order ? receiptFor(this.sources, order) : null;
  }
}

/**
 * The guest's receipt for one of their own orders — placed from their account, or
 * rung up at the counter for their phone — without the costs on its lines. Anyone
 * else's reads as `null`, the same as a missing one, so ids can't be probed.
 */
export class GetOwnOrderReceipt {
  constructor(private readonly sources: ReceiptSources) {}

  async execute(orderId: string, guestId: string): Promise<OrderReceipt | null> {
    const order = await this.sources.orders.getById(orderId);
    if (!order || !isOrderOf(order, guestId)) return null;
    return receiptFor(this.sources, withoutCosts(order));
  }
}
