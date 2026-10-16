import { cafeDayOf } from "../../entities/CafeTime";
import { costOfSalesEntry, paymentEntry, paymentReturnEntry, saleEntry } from "../../entities/Postings";

import type { ActivityActor } from "../../entities/ActivityEntry";
import type { NewJournalEntry } from "../../entities/Ledger";
import type { Order } from "../../entities/Order";
import type { LedgerHook } from "../../repositories/ILedgerRepository";

/**
 * What the books need when an order changes status, computed from the order as
 * saved (inside the same transaction):
 *  - `completed` — the sale (revenue by kind + VAT) and its cost of sales;
 *  - `cancelled` after payment (the repository marks it `refunded`) — the money back.
 *
 * Completed and cancelled are both terminal, so a sale is never undone here. A
 * free order books nothing; an order paid before accounting existed carries no
 * method and had no payment entry, so its refund books nothing either.
 */
export function statusPostings(actor: ActivityActor, now: Date = new Date()): LedgerHook<Order> {
  return (order, settings) => {
    const day = cafeDayOf(now);
    const entries: NewJournalEntry[] = [];
    if (order.total <= 0) return entries;

    if (order.status === "completed") {
      entries.push(saleEntry(order, settings.vatRateBps, day, actor));
      const cost = costOfSalesEntry(order, day, actor);
      if (cost) entries.push(cost);
    }
    if (order.status === "cancelled" && order.paymentStatus === "refunded" && order.paymentMethod) {
      entries.push(paymentReturnEntry(order, order.paymentMethod, "orderRefund", day, actor));
    }
    return entries;
  };
}

/**
 * The money side of marking an order paid or unpaid. `previous` is the order as it
 * stood before — an unmark reverses the payment through the method it was taken by.
 */
export function paymentPostings(previous: Order, actor: ActivityActor, now: Date = new Date()): LedgerHook<Order> {
  return (order) => {
    const day = cafeDayOf(now);
    if (order.total <= 0) return [];
    if (order.paymentStatus === "paid" && order.paymentMethod) {
      return [paymentEntry(order, order.paymentMethod, day, actor)];
    }
    if (order.paymentStatus === "unpaid" && previous.paymentStatus === "paid" && previous.paymentMethod) {
      return [paymentReturnEntry(order, previous.paymentMethod, "orderPaymentReversal", day, actor)];
    }
    return [];
  };
}
