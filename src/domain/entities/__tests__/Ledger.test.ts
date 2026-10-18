import { describe, expect, it } from "vitest";

import {
  allocate,
  assertBalanced,
  reversalOf,
  signedBalance,
  UnbalancedEntryError,
  vatIncluded,
  type JournalEntry,
} from "../Ledger";
import {
  costOfSalesEntry,
  expenseEntry,
  expensePaymentEntry,
  paymentEntry,
  paymentReturnEntry,
  saleEntry,
} from "../Postings";

import type { Expense } from "../Expense";
import type { Order } from "../Order";

const ACTOR = { id: "staff", name: "Ali" };

const ORDER: Order = {
  id: "o1",
  orderNumber: 42,
  userId: "g",
  customerName: "Sara",
  customerPhone: "0912",
  status: "completed",
  serviceType: "dineIn",
  tableLabel: "4",
  paymentStatus: "unpaid",
  items: [
    {
      id: "i1",
      productId: "p1",
      kind: "drink",
      name: "Cappuccino",
      imageUrl: "",
      unitPrice: 145000,
      unitCost: 40000,
      stockTracked: true,
      quantity: 2,
    },
    { id: "i2", productId: "p2", kind: "food", name: "Cake", imageUrl: "", unitPrice: 110000, quantity: 1 },
    {
      id: "i3",
      productId: "p3",
      kind: "book",
      name: "Book",
      imageUrl: "",
      unitPrice: 280000,
      unitCost: 180000,
      stockTracked: true,
      quantity: 1,
    },
  ],
  subtotal: 680000,
  promoDiscount: 0,
  pointsRedeemed: 0,
  pointsDiscount: 0,
  pointsEarned: 0,
  total: 680000,
  placedAt: "2026-10-16T10:00:00Z",
  updatedAt: "2026-10-16T10:00:00Z",
};

const totals = (entry: { lines: { debit: number; credit: number }[] }) => ({
  debit: entry.lines.reduce((s, l) => s + l.debit, 0),
  credit: entry.lines.reduce((s, l) => s + l.credit, 0),
});

describe("ledger primitives", () => {
  it("allocates whole units that always add up", () => {
    expect(allocate(100, [1, 1, 1])).toEqual([34, 33, 33]);
    expect(allocate(618182, [290000, 110000, 280000]).reduce((a, b) => a + b, 0)).toBe(618182);
    expect(allocate(5, [0, 0])).toEqual([0, 0]);
  });

  it("extracts VAT from an inclusive price", () => {
    expect(vatIncluded(110000, 1000)).toBe(10000);
    expect(vatIncluded(680000, 1000)).toBe(61818);
    expect(vatIncluded(680000, 0)).toBe(0);
  });

  it("refuses unbalanced or malformed entries", () => {
    const line = (debit: number, credit: number) => ({ accountCode: "1110", debit, credit });
    expect(() => assertBalanced({ lines: [line(100, 0), line(0, 90)] })).toThrow(UnbalancedEntryError);
    expect(() => assertBalanced({ lines: [line(100, 100), line(0, 0)] })).toThrow(UnbalancedEntryError);
    expect(() => assertBalanced({ lines: [line(-5, 0), line(0, -5)] })).toThrow(UnbalancedEntryError);
    expect(() => assertBalanced({ lines: [line(1.5, 0), line(0, 1.5)] })).toThrow(UnbalancedEntryError);
    expect(() => assertBalanced({ lines: [line(100, 0)] })).toThrow(UnbalancedEntryError);
    expect(assertBalanced({ lines: [line(100, 0), line(0, 100), line(0, 0)] }).lines).toHaveLength(2);
  });

  it("reads balances on each account's normal side", () => {
    expect(signedBalance("asset", 500, 200)).toBe(300);
    expect(signedBalance("revenue", 0, 900)).toBe(900);
  });
});

describe("posting rules", () => {
  it("books a sale: receivable for the total, VAT split out, revenue by kind, balanced", () => {
    const entry = assertBalanced(saleEntry(ORDER, 1000, "2026-10-16", ACTOR));
    expect(totals(entry)).toEqual({ debit: 680000, credit: 680000 });
    const credit = (code: string) => entry.lines.find((l) => l.accountCode === code)?.credit;
    expect(credit("2200")).toBe(61818);
    expect((credit("4100") ?? 0) + (credit("4200") ?? 0) + (credit("4300") ?? 0)).toBe(680000 - 61818);
    expect(entry.uniqueKey).toBe("order:o1:sale");
  });

  it("takes VAT only from taxable lines — an exempt book carries none", () => {
    const withExemptBook: Order = {
      ...ORDER,
      items: ORDER.items.map((item) => ({ ...item, taxExempt: item.kind === "book" })),
    };
    const entry = assertBalanced(saleEntry(withExemptBook, 1000, "2026-10-16", ACTOR));
    const credit = (code: string) => entry.lines.find((l) => l.accountCode === code)?.credit;
    expect(credit("2200")).toBe(36364);
    expect(credit("4300")).toBe(280000);
    expect(credit("4200")).toBe(100000);
    expect(credit("4100")).toBe(263636);
    expect(totals(entry)).toEqual({ debit: 680000, credit: 680000 });
  });

  it("books cost of sales only for lines whose recipe used stock", () => {
    const entry = costOfSalesEntry(ORDER, "2026-10-16", ACTOR);
    expect(entry?.lines).toEqual([
      { accountCode: "5100", debit: 260000, credit: 0 },
      { accountCode: "1200", debit: 0, credit: 260000 },
    ]);
    expect(costOfSalesEntry({ ...ORDER, items: [ORDER.items[1]] }, "2026-10-16", ACTOR)).toBeNull();
  });

  it("puts each payment method's money in its account, and refunds it the same way", () => {
    expect(paymentEntry(ORDER, "cash", "2026-10-16", ACTOR).lines[0].accountCode).toBe("1110");
    expect(paymentEntry(ORDER, "card", "2026-10-16", ACTOR).lines[0].accountCode).toBe("1120");
    expect(paymentEntry(ORDER, "transfer", "2026-10-16", ACTOR).lines[0].accountCode).toBe("1120");
    expect(paymentEntry(ORDER, "online", "2026-10-16", ACTOR).lines[0].accountCode).toBe("1130");
    const refund = paymentReturnEntry(ORDER, "card", "orderRefund", "2026-10-16", ACTOR);
    expect(refund.lines).toEqual([
      { accountCode: "1150", debit: 680000, credit: 0 },
      { accountCode: "1120", debit: 0, credit: 680000 },
    ]);
  });

  it("books an owed expense to payables, then its payment out of the bank", () => {
    const expense: Expense = {
      id: "e1",
      number: 3,
      date: "2026-10-01",
      accountCode: "1200",
      description: "Books from publisher",
      supplierName: "Cheshmeh",
      amount: 1100000,
      vatAmount: 100000,
      status: "unpaid",
      createdById: "a",
      createdByName: "Admin",
      createdAt: "",
    };
    const booked = assertBalanced(expenseEntry(expense, ACTOR));
    expect(booked.lines.map((l) => [l.accountCode, l.debit, l.credit])).toEqual([
      ["1200", 1000000, 0],
      ["2200", 100000, 0],
      ["2100", 0, 1100000],
    ]);
    const paid = assertBalanced(expensePaymentEntry(expense, "bank", "2026-10-10", ACTOR));
    expect(paid.lines.map((l) => [l.accountCode, l.debit, l.credit])).toEqual([
      ["2100", 1100000, 0],
      ["1120", 0, 1100000],
    ]);
    const paidNow = assertBalanced(expenseEntry({ ...expense, status: "paid", paidFrom: "cash", vatAmount: 0 }, ACTOR));
    expect(paidNow.lines.map((l) => l.accountCode)).toEqual(["1200", "1110"]);
  });

  it("reverses an entry by swapping sides", () => {
    const entry: JournalEntry = {
      ...assertBalanced(paymentEntry(ORDER, "cash", "2026-10-16", ACTOR)),
      id: "je1",
      number: 7,
      createdAt: "",
    };
    const reversal = reversalOf(entry, "2026-10-17", "wrong order", ACTOR);
    expect(reversal.lines.map((l) => [l.accountCode, l.debit, l.credit])).toEqual([
      ["1110", 0, 680000],
      ["1150", 680000, 0],
    ]);
    expect(reversal.description).toBe("Reversal of JE-7: wrong order");
    expect(reversal.uniqueKey).toBe("reversal:je1");
  });
});
