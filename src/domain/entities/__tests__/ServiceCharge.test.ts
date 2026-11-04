import { describe, expect, it } from "vitest";

import { assertBalanced, SYSTEM_ACCOUNTS } from "../Ledger";
import { serviceChargeFor, type Order } from "../Order";
import { orderReceipt } from "../OrderReceipt";
import { priceRefundLines, type OrderRefund } from "../OrderRefund";
import { orderReturnEntry, orderWriteOffEntry, saleEntry, saleSplit } from "../Postings";

const ACTOR = { id: "s1", name: "Staff" };

/**
 * A dine-in order: a latte (VAT inside its price) and a book (VAT-exempt), with a
 * 10% service charge on the 300,000 they come to — 330,000 in all, at 10% VAT.
 */
const ORDER = {
  id: "o1",
  orderNumber: 7,
  total: 330_000,
  serviceCharge: 30_000,
  serviceChargeBps: 1000,
  items: [
    { id: "i1", kind: "drink", name: "Latte", unitPrice: 100_000, quantity: 1 },
    { id: "i2", kind: "book", name: "Novel", unitPrice: 200_000, quantity: 1, taxExempt: true },
  ],
} as Order;

/** `[account, debit, credit]` per line, for compact assertions. */
function sides(entry: { lines: { accountCode: string; debit: number; credit: number }[] }) {
  return entry.lines.map((line) => [line.accountCode, line.debit, line.credit]);
}

describe("serviceChargeFor", () => {
  it("charges dine-in orders the rate on what's left after discounts, rounded to the Toman", () => {
    expect(serviceChargeFor(300_000, 1000, "dineIn")).toBe(30_000);
    expect(serviceChargeFor(123_455, 750, "dineIn")).toBe(9_259);
  });

  it("charges nothing for a takeaway, at a 0 rate, or on nothing", () => {
    expect(serviceChargeFor(300_000, 1000, "takeaway")).toBe(0);
    expect(serviceChargeFor(300_000, 0, "dineIn")).toBe(0);
    expect(serviceChargeFor(0, 1000, "dineIn")).toBe(0);
  });
});

describe("the sale of an order with a service charge", () => {
  it("books the charge as its own income, net of the VAT inside it", () => {
    const entry = assertBalanced(saleEntry(ORDER, 1000, "2026-11-04", ACTOR));
    expect(sides(entry)).toEqual([
      [SYSTEM_ACCOUNTS.guestReceivables, 330_000, 0],
      [SYSTEM_ACCOUNTS.salesDrinks, 0, 90_909],
      [SYSTEM_ACCOUNTS.salesBooks, 0, 200_000],
      [SYSTEM_ACCOUNTS.serviceCharges, 0, 27_273],
      // VAT on the latte and on the whole charge — the book carries none, its service does.
      [SYSTEM_ACCOUNTS.vatPayable, 0, 11_818],
    ]);
  });

  it("prints the same VAT on the receipt", () => {
    expect(saleSplit(ORDER, 1000)).toMatchObject({ vat: 11_818, serviceVat: 2_727 });
    expect(orderReceipt(ORDER, [], 1000).vatIncluded).toBe(11_818);
  });

  it("books an order without a charge exactly as before", () => {
    const plain = { ...ORDER, total: 300_000, serviceCharge: 0, serviceChargeBps: 0 };
    const lines = saleEntry(plain, 1000, "2026-11-04", ACTOR).lines.map((line) => line.accountCode);
    expect(lines).not.toContain(SYSTEM_ACCOUNTS.serviceCharges);
    expect(saleSplit(plain, 1000).vat).toBe(9_091);
  });

  it("takes the charge back out when the order is written off", () => {
    const sale = saleEntry(ORDER, 1000, "2026-11-04", ACTOR);
    const entry = assertBalanced(orderWriteOffEntry(ORDER, sale, "2026-11-05", undefined, ACTOR));
    expect(sides(entry)).toContainEqual([SYSTEM_ACCOUNTS.serviceCharges, 27_273, 0]);
    expect(sides(entry)).toContainEqual([SYSTEM_ACCOUNTS.guestReceivables, 0, 330_000]);
  });
});

describe("refunds on an order with a service charge", () => {
  // The VAT the sale booked, and the part of it inside the charge (30,000 − 27,273).
  const SALE_VAT = 11_818;
  const SERVICE_VAT = 2_727;

  function refundOf(lines: OrderRefund["lines"]): OrderRefund {
    return {
      id: "r1",
      number: 1,
      orderId: "o1",
      date: "2026-11-05",
      method: "cash",
      amount: lines.reduce((sum, line) => sum + line.amount, 0),
      vatAmount: lines.reduce((sum, line) => sum + line.vatAmount, 0),
      lines,
      createdById: "s1",
      createdByName: "Staff",
      createdAt: "",
    };
  }

  it("hands back each line's share of the charge, with its VAT, in proportion", () => {
    const priced = priceRefundLines(ORDER, SALE_VAT, [{ itemId: "i1", quantity: 1, restock: false }], SERVICE_VAT);
    expect(priced.lines).toEqual([
      expect.objectContaining({
        amount: 110_000,
        serviceCharge: 10_000,
        serviceChargeVat: 909,
        // The latte's own VAT and its service share's.
        vatAmount: 10_000,
      }),
    ]);
  });

  it("reverses the charge out of service charge income, and the rest out of sales", () => {
    const priced = priceRefundLines(ORDER, SALE_VAT, [{ itemId: "i1", quantity: 1, restock: false }], SERVICE_VAT);
    const entry = assertBalanced(orderReturnEntry(ORDER, refundOf(priced.lines ?? []), ACTOR));
    expect(sides(entry)).toEqual([
      [SYSTEM_ACCOUNTS.salesDrinks, 90_909, 0],
      [SYSTEM_ACCOUNTS.serviceCharges, 9_091, 0],
      [SYSTEM_ACCOUNTS.vatPayable, 10_000, 0],
      [SYSTEM_ACCOUNTS.cash, 0, 110_000],
    ]);
  });

  it("brings everything back to the Toman when the whole order is refunded", () => {
    const priced = priceRefundLines(
      ORDER,
      SALE_VAT,
      [
        { itemId: "i1", quantity: 1, restock: false },
        { itemId: "i2", quantity: 1, restock: true },
      ],
      SERVICE_VAT,
    );
    const lines = priced.lines ?? [];
    expect(lines.reduce((sum, line) => sum + line.amount, 0)).toBe(330_000);
    expect(lines.reduce((sum, line) => sum + line.serviceCharge, 0)).toBe(30_000);
    expect(lines.reduce((sum, line) => sum + line.vatAmount, 0)).toBe(SALE_VAT);

    const entry = assertBalanced(orderReturnEntry(ORDER, refundOf(lines), ACTOR));
    // Exactly what the sale credited, debited back.
    expect(sides(entry)).toEqual([
      [SYSTEM_ACCOUNTS.salesDrinks, 90_909, 0],
      [SYSTEM_ACCOUNTS.salesBooks, 200_000, 0],
      [SYSTEM_ACCOUNTS.serviceCharges, 27_273, 0],
      [SYSTEM_ACCOUNTS.vatPayable, 11_818, 0],
      [SYSTEM_ACCOUNTS.cash, 0, 330_000],
    ]);
  });
});
