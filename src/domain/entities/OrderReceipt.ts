import { paymentPartsOf, type Order, type PaymentPart } from "./Order";
import { saleSplit } from "./Postings";

import type { OrderRefund } from "./OrderRefund";

/**
 * What a receipt prints for an order: the order as it stands, how it was paid, the
 * money that came back on it, and the VAT inside what the guest pays — worked out
 * the way the books split the sale, so the receipt and the VAT return agree.
 *
 * The same receipt serves staff (printed at the counter) and the guest (their own
 * order's page); the guest's carries the order without its costs.
 */
export type OrderReceipt = {
  order: Order;
  /** How it was paid, by part; empty while it's unpaid. */
  payments: PaymentPart[];
  /** Money handed back after it was served, oldest first. */
  refunds: Pick<OrderRefund, "number" | "date" | "method" | "amount">[];
  /** The VAT rate inside menu prices, in basis points (1000 = 10%). */
  vatRateBps: number;
  /** The VAT inside the total, in Toman. Exempt lines (books) carry none. */
  vatIncluded: number;
};

/** The receipt for an order, its refunds and the cafe's VAT rate. */
export function orderReceipt(
  order: Order,
  refunds: readonly Pick<OrderRefund, "number" | "date" | "method" | "amount">[],
  vatRateBps: number,
): OrderReceipt {
  return {
    order,
    payments: paymentPartsOf(order),
    refunds: refunds.map(({ number, date, method, amount }) => ({ number, date, method, amount })),
    vatRateBps,
    vatIncluded: order.total > 0 ? saleSplit(order, vatRateBps).vat : 0,
  };
}
