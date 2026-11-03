import { describe, expect, it } from "vitest";

import { assertBalanced } from "../Ledger";
import {
  expensePaymentEntry,
  incomeEntry,
  loanDepositEntry,
  loanDepositSettledEntry,
  orderReturnCostEntry,
  orderReturnEntry,
  orderWriteOffEntry,
  paymentEntry,
  paymentReturnEntry,
  saleEntry,
} from "../Postings";

import type { BookLoan } from "../BookLoan";
import type { Expense } from "../Expense";
import type { Income } from "../Income";
import type { Order } from "../Order";
import type { OrderRefund } from "../OrderRefund";

const ACTOR = { id: "staff", name: "Sara" };
const ORDER = { id: "o1", orderNumber: 42, total: 300_000 } as Order;

const sides = (entry: { lines: { accountCode: string; debit: number; credit: number }[] }) =>
  entry.lines.map((line) => [line.accountCode, line.debit, line.credit]);

describe("a split payment", () => {
  it("debits each account its part, and merges parts landing in the same one", () => {
    const entry = paymentEntry(
      ORDER,
      [
        { method: "cash", amount: 100_000 },
        { method: "card", amount: 150_000 },
        { method: "transfer", amount: 50_000 },
      ],
      "2026-10-20",
      ACTOR,
    );

    expect(sides(assertBalanced(entry))).toEqual([
      ["1110", 100_000, 0],
      ["1120", 200_000, 0],
      ["1150", 0, 300_000],
    ]);
    expect(entry.description).toBe("Order #42 — payment (cash + card + transfer)");
  });

  it("goes back the way it came", () => {
    const entry = paymentReturnEntry(
      ORDER,
      [
        { method: "cash", amount: 100_000 },
        { method: "online", amount: 200_000 },
      ],
      "orderRefund",
      "2026-10-20",
      ACTOR,
    );

    expect(sides(assertBalanced(entry))).toEqual([
      ["1150", 300_000, 0],
      ["1110", 0, 100_000],
      ["1130", 0, 200_000],
    ]);
  });
});

describe("a refund on a completed order", () => {
  const refund: OrderRefund = {
    id: "r1",
    number: 3,
    orderId: "o1",
    date: "2026-10-20",
    method: "card",
    amount: 310_000,
    vatAmount: 10_000,
    lines: [
      {
        orderItemId: "i1",
        name: "Latte",
        kind: "drink",
        quantity: 1,
        amount: 110_000,
        vatAmount: 10_000,
        restocked: false,
      },
      {
        orderItemId: "i2",
        name: "Novel",
        kind: "book",
        quantity: 1,
        amount: 200_000,
        vatAmount: 0,
        restocked: true,
      },
    ],
    createdById: ACTOR.id,
    createdByName: ACTOR.name,
    createdAt: "",
  };

  it("comes off revenue by kind and output VAT, and out of the method's account", () => {
    const entry = orderReturnEntry(ORDER, refund, ACTOR);

    expect(sides(assertBalanced(entry))).toEqual([
      ["4100", 100_000, 0],
      ["4300", 200_000, 0],
      ["2200", 10_000, 0],
      ["1120", 0, 310_000],
    ]);
    expect(entry).toMatchObject({ source: "orderReturn", sourceId: "o1", uniqueKey: "orderRefund:r1" });
  });

  it("takes the cost of units back on the shelf out of cost of sales", () => {
    const entry = orderReturnCostEntry(ORDER, refund, 120_000, ACTOR);

    expect(sides(assertBalanced(entry ?? { lines: [] }))).toEqual([
      ["1200", 120_000, 0],
      ["5100", 0, 120_000],
    ]);
    expect(orderReturnCostEntry(ORDER, refund, 0, ACTOR)).toBeNull();
  });
});

describe("a served order nobody paid for, written off", () => {
  // The sale as booked at completion (10% VAT). The write-off follows it line by
  // line rather than re-pricing the order, so a rate changed since leaves nothing behind.
  const sale = saleEntry(
    {
      ...ORDER,
      items: [
        { kind: "drink", unitPrice: 100_000, quantity: 1 },
        { kind: "book", unitPrice: 200_000, quantity: 1, taxExempt: true },
      ],
    } as Order,
    1000,
    "2026-10-19",
    ACTOR,
  );

  it("takes the sale's revenue and VAT back out against the receivable it left", () => {
    const entry = orderWriteOffEntry(ORDER, sale, "2026-10-20", undefined, ACTOR);

    expect(sides(assertBalanced(entry))).toEqual([
      ["1150", 0, 300_000],
      ["4100", 90_909, 0],
      ["4300", 200_000, 0],
      ["2200", 9_091, 0],
    ]);
    // Cost of sales and inventory stay as they are: the goods were consumed.
    expect(entry.lines.map((line) => line.accountCode)).not.toContain("5100");
    expect(entry).toMatchObject({
      date: "2026-10-20",
      source: "orderWriteOff",
      sourceId: "o1",
      uniqueKey: "order:o1:writeOff",
      description: "Order #42 — written off",
    });
  });

  it("carries the reason staff gave", () => {
    expect(orderWriteOffEntry(ORDER, sale, "2026-10-20", "Walked out", ACTOR).description).toBe(
      "Order #42 — written off: Walked out",
    );
  });
});

describe("income outside an order", () => {
  const income: Income = {
    id: "n1",
    number: 7,
    date: "2026-10-20",
    accountCode: "4400",
    description: "Poetry night × 2",
    amount: 220_000,
    vatAmount: 20_000,
    method: "transfer",
    payerName: "Sara",
    status: "received",
    createdById: ACTOR.id,
    createdByName: ACTOR.name,
    createdAt: "",
  };

  it("lands in the method's account, with the VAT inside it on VAT payable", () => {
    const entry = incomeEntry(income, ACTOR);

    expect(sides(assertBalanced(entry))).toEqual([
      ["1120", 220_000, 0],
      ["4400", 0, 200_000],
      ["2200", 0, 20_000],
    ]);
    expect(entry).toMatchObject({ source: "income", sourceId: "n1", uniqueKey: "income:n1" });
  });
});

describe("a loan deposit", () => {
  const loan = {
    id: "l1",
    reference: 12,
    borrowerName: "Sara",
    status: "out",
    depositAmount: 500_000,
    depositMethod: "cash",
    depositState: "held",
  } as BookLoan;

  it("is held as a liability, not income", () => {
    expect(sides(assertBalanced(loanDepositEntry(loan, "2026-10-20", ACTOR) ?? { lines: [] }))).toEqual([
      ["1110", 500_000, 0],
      ["2400", 0, 500_000],
    ]);
  });

  it("goes back with the book", () => {
    const entry = loanDepositSettledEntry({ ...loan, status: "returned" }, "out", "2026-10-20", ACTOR);

    expect(sides(assertBalanced(entry ?? { lines: [] }))).toEqual([
      ["2400", 500_000, 0],
      ["1110", 0, 500_000],
    ]);
  });

  it("becomes income when the book is lost", () => {
    const entry = loanDepositSettledEntry({ ...loan, status: "lost" }, "out", "2026-10-20", ACTOR);

    expect(sides(assertBalanced(entry ?? { lines: [] }))).toEqual([
      ["2400", 500_000, 0],
      ["4900", 0, 500_000],
    ]);
  });

  it("comes back out of income when a lost book turns up", () => {
    const entry = loanDepositSettledEntry({ ...loan, status: "returned" }, "lost", "2026-10-20", ACTOR);

    expect(sides(assertBalanced(entry ?? { lines: [] }))).toEqual([
      ["4900", 500_000, 0],
      ["1110", 0, 500_000],
    ]);
  });

  it("posts nothing without a deposit", () => {
    const none = { ...loan, depositAmount: 0, depositMethod: undefined };

    expect(loanDepositEntry(none, "2026-10-20", ACTOR)).toBeNull();
    expect(loanDepositSettledEntry({ ...none, status: "returned" }, "out", "2026-10-20", ACTOR)).toBeNull();
  });
});

describe("a part payment on a bill", () => {
  it("clears that much of accounts payable, keyed by the paid total", () => {
    const expense = { id: "x1", number: 14, supplierName: "Beans Co", paidAmount: 400_000 } as Expense;
    const entry = expensePaymentEntry(expense, { amount: 150_000, source: "bank", date: "2026-10-20" }, ACTOR);

    expect(sides(assertBalanced(entry))).toEqual([
      ["2100", 150_000, 0],
      ["1120", 0, 150_000],
    ]);
    expect(entry.uniqueKey).toBe("expense:x1:payment:400000");
  });
});
