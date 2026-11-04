import { allocate } from "./Ledger";
import { refundableQuantity, type Order, type OrderItem, type PaymentMethod } from "./Order";

import type { ProductKind } from "./Product";

/**
 * Money handed back on a completed order: a book brought back, a drink remade.
 * A cancellation undoes an order before it's served; this undoes part or all of one
 * after, so the sale stays on the books and the refund is its own document.
 *
 * Each line's price is its share of what the guest actually paid, discounts
 * included, and its VAT is its share of the VAT the sale booked — the same split
 * the sale was posted with, so a line refunded in full comes back to the Toman.
 */

export const MAX_REFUND_REASON_LENGTH = 200;

export type OrderRefundLine = {
  orderItemId: string;
  name: string;
  kind: ProductKind;
  quantity: number;
  /** Whole Toman handed back for these units, VAT included. */
  amount: number;
  vatAmount: number;
  /**
   * The share of the order's service charge inside `amount`, and the VAT inside
   * that share (part of `vatAmount`): a refund hands the charge back in proportion.
   */
  serviceCharge: number;
  serviceChargeVat: number;
  /** The units went back on the shelf (a book can; a drink can't). */
  restocked: boolean;
};

export type OrderRefund = {
  id: string;
  /** Sequential number staff refer to ("R-12"). */
  number: number;
  orderId: string;
  /** The cafe day it was handed back. */
  date: string;
  /** The way the money went back; it decides the account it leaves. */
  method: PaymentMethod;
  amount: number;
  vatAmount: number;
  reason?: string;
  lines: OrderRefundLine[];
  createdById: string;
  createdByName: string;
  createdAt: string;
};

/** A refund about to be recorded, with what each line had already refunded when it was priced. */
export type NewOrderRefund = Omit<OrderRefund, "id" | "number" | "createdAt"> & {
  /** Each refunded item's `refundedQuantity` as priced — the repository's concurrency guard. */
  expectedRefunded: Readonly<Record<string, number>>;
};

/** What staff chose for one line. */
export type RefundLineRequest = { itemId: string; quantity: number; restock: boolean };

/**
 * A running share of `whole` for `units` of `quantity`, rounded down. Refunds work
 * out of this rather than a per-unit price, so handing a line back unit by unit
 * still adds up to exactly what it was sold for.
 */
function shareOf(whole: number, units: number, quantity: number): number {
  return Math.floor((whole * units) / quantity);
}

/**
 * Price the units staff picked. `saleVat` is the VAT the order's sale actually
 * booked, not today's rate: the rate may have changed since — and `saleServiceVat`
 * the part of it inside the service charge, read off the same sale. Refuses (with
 * the problem's key) anything but whole units still on the order.
 *
 * Each line's share of the total carries its share of the service charge (the
 * charge allocated over the lines by value, like the total), so units handed back
 * take their service charge back with them, and a line refunded in full returns
 * all of it. An order without a service charge prices exactly as it always did.
 */
export function priceRefundLines(
  order: Pick<Order, "items" | "total"> & Partial<Pick<Order, "serviceCharge">>,
  saleVat: number,
  requests: readonly RefundLineRequest[],
  saleServiceVat = 0,
): { lines: OrderRefundLine[]; problem?: undefined } | { lines?: undefined; problem: string } {
  if (requests.length === 0) return { problem: "refundLinesRequired" };
  if (new Set(requests.map((request) => request.itemId)).size !== requests.length) {
    return { problem: "refundLinesRequired" };
  }

  const weights = order.items.map((item) => item.unitPrice * item.quantity);
  const lineTotals = allocate(order.total, weights);
  const lineService = allocate(Math.max(0, order.serviceCharge ?? 0), weights).map((amount, index) =>
    Math.min(amount, lineTotals[index]),
  );
  const serviceVat = Math.max(0, Math.min(saleServiceVat, saleVat));
  const lineGoodsVat = allocate(
    saleVat - serviceVat,
    order.items.map((item, index) => (item.taxExempt ? 0 : lineTotals[index] - lineService[index])),
  );
  const lineServiceVat = allocate(serviceVat, lineService);
  const share = (amounts: readonly number[], index: number, before: number, after: number, quantity: number) =>
    shareOf(amounts[index], after, quantity) - shareOf(amounts[index], before, quantity);

  const lines: OrderRefundLine[] = [];
  for (const request of requests) {
    const index = order.items.findIndex((item) => item.id === request.itemId);
    const item: OrderItem | undefined = order.items[index];
    if (!item) return { problem: "refundLineUnknown" };
    if (!Number.isInteger(request.quantity) || request.quantity < 1 || request.quantity > refundableQuantity(item)) {
      return { problem: "refundQuantityInvalid" };
    }
    const before = item.refundedQuantity ?? 0;
    const after = before + request.quantity;
    const serviceCharge = share(lineService, index, before, after, item.quantity);
    const serviceChargeVat = Math.min(share(lineServiceVat, index, before, after, item.quantity), serviceCharge);
    lines.push({
      orderItemId: item.id,
      name: item.name,
      kind: item.kind,
      quantity: request.quantity,
      amount: share(lineTotals, index, before, after, item.quantity),
      vatAmount: share(lineGoodsVat, index, before, after, item.quantity) + serviceChargeVat,
      serviceCharge,
      serviceChargeVat,
      restocked: request.restock,
    });
  }
  return { lines };
}

/** The loyalty points a refund's share of the order earned: what it gives back. */
export function pointsToClawBack(order: Pick<Order, "pointsEarned" | "total">, refundAmount: number): number {
  if (order.pointsEarned <= 0 || order.total <= 0) return 0;
  return Math.ceil((order.pointsEarned * refundAmount) / order.total);
}
