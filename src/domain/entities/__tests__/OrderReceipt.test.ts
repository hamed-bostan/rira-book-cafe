import { describe, expect, it } from "vitest";

import { SYSTEM_ACCOUNTS } from "../Ledger";
import { orderReceipt } from "../OrderReceipt";
import { saleEntry } from "../Postings";

import type { Order } from "../Order";
import type { OrderRefund } from "../OrderRefund";

const ORDER = {
  id: "o1",
  orderNumber: 42,
  total: 270_000,
  items: [
    { kind: "drink", unitPrice: 100_000, quantity: 1 },
    { kind: "book", unitPrice: 200_000, quantity: 1, taxExempt: true },
  ],
  paymentMethod: "card",
  paymentParts: [
    { method: "card", amount: 200_000 },
    { method: "cash", amount: 70_000 },
  ],
} as Order;

const REFUND = {
  id: "r1",
  number: 3,
  date: "2026-11-03",
  method: "card",
  amount: 20_000,
  vatAmount: 1_818,
  createdByName: "Bita",
  lines: [],
} as unknown as OrderRefund;

describe("an order's receipt", () => {
  it("prints the VAT inside the total exactly as the sale books it", () => {
    const receipt = orderReceipt(ORDER, [], 1000);
    const sale = saleEntry(ORDER, 1000, "2026-11-03", { id: "s", name: "Bita" });
    const bookedVat = sale.lines.find((line) => line.accountCode === SYSTEM_ACCOUNTS.vatPayable)?.credit;

    // A promo or points discount (270,000 of 300,000) is shared over the lines first; the book carries none.
    expect(receipt.vatIncluded).toBe(bookedVat);
    expect(receipt.vatIncluded).toBe(8_182);
    expect(receipt.vatRateBps).toBe(1000);
  });

  it("lists how it was paid and what came back, without the refund's internals", () => {
    const receipt = orderReceipt(ORDER, [REFUND], 1000);

    expect(receipt.payments).toEqual(ORDER.paymentParts);
    expect(receipt.refunds).toEqual([{ number: 3, date: "2026-11-03", method: "card", amount: 20_000 }]);
  });

  it("has no VAT for a free order and no payments while it's unpaid", () => {
    const free = { ...ORDER, total: 0, paymentMethod: undefined, paymentParts: [] } as Order;
    expect(orderReceipt(free, [], 1000)).toMatchObject({ vatIncluded: 0, payments: [] });
  });
});
