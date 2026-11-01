import { describe, expect, it } from "vitest";

import { GET as getReport } from "@/app/api/admin/accounting/reports/[report]/route";
import { PATCH as changeLoan } from "@/app/api/admin/book-loans/[id]/route";
import { POST as lendBook } from "@/app/api/admin/book-loans/route";
import { POST as payExpense } from "@/app/api/admin/expenses/[id]/pay/route";
import { POST as recordExpense } from "@/app/api/admin/expenses/route";
import { POST as voidIncome } from "@/app/api/admin/income/[id]/void/route";
import { GET as listIncome, POST as recordIncome } from "@/app/api/admin/income/route";
import { GET as untrackedBooks, POST as trackBooks } from "@/app/api/admin/inventory/books/route";
import { GET as getInventory } from "@/app/api/admin/inventory/route";
import { PATCH as setPayment } from "@/app/api/admin/orders/[id]/payment/route";
import { GET as listRefunds, POST as refundOrder } from "@/app/api/admin/orders/[id]/refunds/route";
import { PATCH as changeStatus } from "@/app/api/admin/orders/[id]/status/route";
import { POST as ringUpSale } from "@/app/api/admin/orders/route";
import { POST as placeOrder } from "@/app/api/orders/route";
import type { BalanceSheet, ProfitAndLoss, TrialBalance, VatReport } from "@/src/domain/entities/AccountingReports";
import type { BookLoan } from "@/src/domain/entities/BookLoan";
import { cafeDayOf } from "@/src/domain/entities/CafeTime";
import type { Expense } from "@/src/domain/entities/Expense";
import type { Income } from "@/src/domain/entities/Income";
import type { InventorySummary } from "@/src/domain/entities/Inventory";
import type { Order } from "@/src/domain/entities/Order";
import type { OrderRefund } from "@/src/domain/entities/OrderRefund";
import type { UntrackedBook } from "@/src/domain/repositories/IInventoryRepository";
import { prisma } from "@/src/infrastructure/prisma/client";

import { getRequest, jsonRequest, readError, readJson, routeParams } from "./helpers/http";
import { signInAs } from "./helpers/session";

const today = cafeDayOf(new Date());
const BOOK = "seed-book-uncle-napoleon";

/** Net debits − credits on an account, across everything posted. */
async function balanceOf(accountCode: string): Promise<number> {
  const sum = await prisma.journalLine.aggregate({ where: { accountCode }, _sum: { debit: true, credit: true } });
  return Number(sum._sum.debit ?? 0) - Number(sum._sum.credit ?? 0);
}

async function report<T>(name: string, query: string): Promise<T> {
  signInAs("admin");
  const response = await getReport(
    getRequest(`/api/admin/accounting/reports/${name}?${query}`),
    routeParams({ report: name }),
  );
  expect(response.status).toBe(200);
  return readJson<T>(response);
}

async function expectBooksBalance(): Promise<void> {
  const trial = await report<TrialBalance>("trial-balance", `asOf=${today}`);
  expect(trial.balanced).toBe(true);
  const sheet = await report<BalanceSheet>("balance-sheet", `asOf=${today}`);
  expect(sheet.balanced).toBe(true);
}

async function ringUp(body: Record<string, unknown>): Promise<Order> {
  signInAs("staff");
  const response = await ringUpSale(
    jsonRequest("POST", "/api/admin/orders", {
      items: [{ productId: "seed-espresso", quantity: 2 }],
      serviceType: "takeaway",
      customerName: "Walk-in guest",
      ...body,
    }),
  );
  expect(response.status).toBe(201);
  return readJson<Order>(response);
}

async function refund(orderId: string, body: unknown): Promise<Response> {
  signInAs("admin");
  return refundOrder(jsonRequest("POST", `/api/admin/orders/${orderId}/refunds`, body), routeParams({ id: orderId }));
}

describe("a counter sale", () => {
  it("is closed to guests, and needs no account to ring up", async () => {
    signInAs("customer");
    const refused = await ringUpSale(
      jsonRequest("POST", "/api/admin/orders", {
        items: [{ productId: "seed-espresso", quantity: 1 }],
        serviceType: "takeaway",
        customerName: "x",
      }),
    );
    expect(refused.status).toBe(401);

    const order = await ringUp({});
    expect(order).toMatchObject({ status: "pending", paymentStatus: "unpaid", total: 2 * 95000, customerPhone: "" });
    expect(order.userId).toBeUndefined();
  });

  it("books a split sale handed over on the spot, cash and card each to their own account", async () => {
    const order = await ringUp({
      paymentParts: [
        { method: "cash", amount: 40000 },
        { method: "card", amount: 150000 },
      ],
      complete: true,
    });

    expect(order).toMatchObject({ status: "completed", paymentStatus: "paid", paymentMethod: "card" });
    expect(order.paymentParts).toEqual([
      { method: "card", amount: 150000 },
      { method: "cash", amount: 40000 },
    ]);
    expect(await balanceOf("1110")).toBe(40000);
    expect(await balanceOf("1120")).toBe(150000);
    // The receivable the sale raised is settled by the two parts together.
    expect(await balanceOf("1150")).toBe(0);
    expect(await prisma.loyaltyTransaction.count()).toBe(0);
    await expectBooksBalance();
  });

  it("refuses a split that doesn't add up, leaving nothing behind", async () => {
    signInAs("staff");
    const response = await ringUpSale(
      jsonRequest("POST", "/api/admin/orders", {
        items: [{ productId: "seed-espresso", quantity: 2 }],
        serviceType: "takeaway",
        customerName: "Walk-in guest",
        paymentParts: [{ method: "cash", amount: 1000 }],
      }),
    );

    expect(response.status).toBe(400);
    expect((await readError(response)).fieldErrors).toMatchObject({ paymentParts: "paymentPartsTotal" });
    expect(await prisma.order.count()).toBe(0);
  });

  it("takes counted stock like a guest's order, and refuses what's sold out", async () => {
    const before = await prisma.product.findUniqueOrThrow({ where: { id: BOOK } });
    await ringUp({ items: [{ productId: BOOK, quantity: 1 }] });
    const after = await prisma.product.findUniqueOrThrow({ where: { id: BOOK } });
    expect(after.stockQuantity).toBe(before.stockQuantity - 1);

    signInAs("staff");
    const response = await ringUpSale(
      jsonRequest("POST", "/api/admin/orders", {
        items: [{ productId: BOOK, quantity: 50 }],
        serviceType: "takeaway",
        customerName: "Walk-in guest",
      }),
    );
    expect(response.status).toBe(409);
  });
});

describe("splitting a bill on an existing order", () => {
  it("books each part, and unmarking takes back every part", async () => {
    const order = await ringUp({});
    signInAs("staff");
    const paid = await setPayment(
      jsonRequest("PATCH", `/api/admin/orders/${order.id}/payment`, {
        paymentStatus: "paid",
        paymentParts: [
          { method: "cash", amount: 90000 },
          { method: "transfer", amount: 100000 },
        ],
      }),
      routeParams({ id: order.id }),
    );
    expect(paid.status).toBe(200);
    expect(await balanceOf("1110")).toBe(90000);
    expect(await balanceOf("1120")).toBe(100000);

    const unpaid = await setPayment(
      jsonRequest("PATCH", `/api/admin/orders/${order.id}/payment`, { paymentStatus: "unpaid" }),
      routeParams({ id: order.id }),
    );
    expect(unpaid.status).toBe(200);
    expect(await readJson<Order>(unpaid)).toMatchObject({ paymentStatus: "unpaid", paymentParts: [] });
    expect(await balanceOf("1110")).toBe(0);
    expect(await balanceOf("1120")).toBe(0);
  });
});

describe("refunding a completed order", () => {
  it("is for the books' people, not the floor", async () => {
    const order = await ringUp({ paymentParts: [{ method: "cash", amount: 190000 }], complete: true });
    signInAs("staff");
    const response = await refundOrder(
      jsonRequest("POST", `/api/admin/orders/${order.id}/refunds`, {
        lines: [{ itemId: order.items[0].id, quantity: 1, restock: false }],
        method: "cash",
      }),
      routeParams({ id: order.id }),
    );

    expect(response.status).toBe(401);
  });

  it("refunds part, then the rest, taking revenue and VAT down to nothing", async () => {
    const order = await ringUp({ paymentParts: [{ method: "cash", amount: 190000 }], complete: true });
    const line = { itemId: order.items[0].id, restock: false };
    const vatBefore = await report<VatReport>("vat", `from=${today}&to=${today}`);
    expect(vatBefore.outputVat).toBeGreaterThan(0);

    const first = await refund(order.id, { lines: [{ ...line, quantity: 1 }], method: "cash", reason: "Spilled" });
    expect(first.status).toBe(201);
    const { order: partly } = await readJson<{ order: Order }>(first);
    expect(partly).toMatchObject({ paymentStatus: "paid", refundedTotal: 95000 });
    expect(await balanceOf("1110")).toBe(95000);

    const second = await refund(order.id, { lines: [{ ...line, quantity: 1 }], method: "cash" });
    expect(second.status).toBe(201);
    const { order: fully } = await readJson<{ order: Order }>(second);
    expect(fully).toMatchObject({ paymentStatus: "refunded", refundedTotal: 190000 });

    expect(await balanceOf("1110")).toBe(0);
    expect(await balanceOf("4100")).toBe(0);
    expect(await balanceOf("2200")).toBe(0);
    expect((await report<VatReport>("vat", `from=${today}&to=${today}`)).outputVat).toBe(0);
    await expectBooksBalance();

    const refused = await refund(order.id, { lines: [{ ...line, quantity: 1 }], method: "cash" });
    expect(refused.status).toBe(409);

    const list = await listRefunds(getRequest(`/api/admin/orders/${order.id}/refunds`), routeParams({ id: order.id }));
    expect((await readJson<OrderRefund[]>(list)).map((row) => row.amount)).toEqual([95000, 95000]);
  });

  it("won't let a partly refunded payment be taken back", async () => {
    const order = await ringUp({ paymentParts: [{ method: "cash", amount: 190000 }], complete: true });
    await refund(order.id, {
      lines: [{ itemId: order.items[0].id, quantity: 1, restock: false }],
      method: "cash",
    });

    const response = await setPayment(
      jsonRequest("PATCH", `/api/admin/orders/${order.id}/payment`, { paymentStatus: "unpaid" }),
      routeParams({ id: order.id }),
    );
    expect(response.status).toBe(409);
  });

  it("takes back the points the refunded share earned from a guest's order", async () => {
    signInAs("customer");
    const placed = await readJson<Order>(
      await placeOrder(
        jsonRequest("POST", "/api/orders", {
          items: [{ productId: "seed-espresso", quantity: 2 }],
          serviceType: "takeaway",
        }),
      ),
    );
    signInAs("staff");
    for (const status of ["preparing", "completed"]) {
      await changeStatus(
        jsonRequest("PATCH", `/api/admin/orders/${placed.id}/status`, { status }),
        routeParams({ id: placed.id }),
      );
    }
    await setPayment(
      jsonRequest("PATCH", `/api/admin/orders/${placed.id}/payment`, { paymentStatus: "paid", paymentMethod: "cash" }),
      routeParams({ id: placed.id }),
    );
    const earned = (await prisma.loyaltyTransaction.findFirstOrThrow({ where: { reason: "earn" } })).delta;

    await refund(placed.id, {
      lines: [{ itemId: placed.items[0].id, quantity: 2, restock: false }],
      method: "cash",
    });

    const total = await prisma.loyaltyTransaction.aggregate({ _sum: { delta: true } });
    expect(earned).toBeGreaterThan(0);
    expect(total._sum.delta).toBe(0);
  });
});

describe("books in stock", () => {
  it("sets up every book for sale, then a sale books its cost and a return brings it back", async () => {
    // The sample data's books already have recipes: a shop starting out has none.
    await prisma.recipeLine.deleteMany({ where: { productId: BOOK } });
    signInAs("admin");
    const untracked = await readJson<UntrackedBook[]>(await untrackedBooks());
    expect(untracked.map((book) => book.id)).toContain(BOOK);
    // Reading-only books aren't sold, so they're left out.
    expect(untracked.map((book) => book.id)).not.toContain("seed-book-savushun");

    const setUp = await trackBooks(jsonRequest("POST", "/api/admin/inventory/books", {}));
    expect(setUp.status).toBe(201);
    expect(await readJson<{ tracked: number }>(setUp)).toMatchObject({ tracked: untracked.length });
    expect(await readJson<UntrackedBook[]>(await untrackedBooks())).toEqual([]);

    const product = await prisma.product.findUniqueOrThrow({ where: { id: BOOK } });
    const stockValue = await balanceOf("1200");
    const order = await ringUp({
      items: [{ productId: BOOK, quantity: 1 }],
      paymentParts: [{ method: "cash", amount: product.price }],
      complete: true,
    });
    expect(await balanceOf("5100")).toBe(product.costPrice);
    expect(await balanceOf("1200")).toBe(stockValue - (product.costPrice ?? 0));

    const refunded = await refund(order.id, {
      lines: [{ itemId: order.items[0].id, quantity: 1, restock: true }],
      method: "cash",
    });
    expect(refunded.status).toBe(201);
    expect(await balanceOf("5100")).toBe(0);
    expect(await balanceOf("1200")).toBe(stockValue);
    const after = await prisma.product.findUniqueOrThrow({ where: { id: BOOK } });
    expect(after.stockQuantity).toBe(product.stockQuantity);

    signInAs("admin");
    const inventory = await readJson<InventorySummary>(await getInventory());
    expect(inventory.difference).toBe(0);
    await expectBooksBalance();
  });

  it("warns on the P&L about sales that booked no cost", async () => {
    await prisma.recipeLine.deleteMany({ where: { productId: "seed-espresso" } });
    await ringUp({ paymentParts: [{ method: "cash", amount: 190000 }], complete: true });

    const pl = await report<ProfitAndLoss>("profit-and-loss", `from=${today}&to=${today}`);
    expect(pl.revenueWithoutCost).toBe(190000);
  });
});

describe("income outside orders", () => {
  const roomHire = {
    date: today,
    accountCode: "4900",
    description: "Room hire",
    amount: "1100000",
    vatAmount: "100000",
    method: "transfer",
    payerName: "Book club",
  };

  it("records and voids income, reversing its entry", async () => {
    signInAs("admin");
    const created = await recordIncome(jsonRequest("POST", "/api/admin/income", roomHire));
    expect(created.status).toBe(201);
    const income = await readJson<Income>(created);
    expect(await balanceOf("1120")).toBe(1100000);
    expect(await balanceOf("4900")).toBe(-1000000);
    expect((await report<VatReport>("vat", `from=${today}&to=${today}`)).outputVat).toBe(100000);

    const list = await readJson<{ items: Income[]; summary: { month: { total: number } } }>(
      await listIncome(getRequest("/api/admin/income")),
    );
    expect(list.items.map((row) => row.id)).toEqual([income.id]);
    expect(list.summary.month.total).toBe(1100000);

    const voided = await voidIncome(
      jsonRequest("POST", `/api/admin/income/${income.id}/void`, { reason: "Handed back" }),
      routeParams({ id: income.id }),
    );
    expect(await readJson<Income>(voided)).toMatchObject({ status: "void" });
    expect(await balanceOf("1120")).toBe(0);
    expect(await balanceOf("4900")).toBe(0);
    expect((await report<VatReport>("vat", `from=${today}&to=${today}`)).outputVat).toBe(0);
    await expectBooksBalance();
  });

  it("is closed to the floor", async () => {
    signInAs("staff");
    const response = await recordIncome(jsonRequest("POST", "/api/admin/income", roomHire));

    expect(response.status).toBe(401);
  });

  it("refuses an account that isn't revenue", async () => {
    signInAs("admin");
    const response = await recordIncome(jsonRequest("POST", "/api/admin/income", { ...roomHire, accountCode: "6100" }));

    expect(response.status).toBe(400);
  });
});

describe("a deposit on a borrowed book", () => {
  const loan = {
    productId: "seed-book-blind-owl",
    borrowerName: "Sara",
    borrowerPhone: "09121234567",
    dueOn: today,
    depositAmount: "500000",
    depositMethod: "cash",
  };

  async function lend(): Promise<BookLoan> {
    signInAs("staff");
    const response = await lendBook(jsonRequest("POST", "/api/admin/book-loans", loan));
    expect(response.status).toBe(201);
    return readJson<BookLoan>(response);
  }

  async function close(id: string, status: string): Promise<BookLoan> {
    signInAs("staff");
    const response = await changeLoan(
      jsonRequest("PATCH", `/api/admin/book-loans/${id}`, { status }),
      routeParams({ id }),
    );
    expect(response.status).toBe(200);
    return readJson<BookLoan>(response);
  }

  it("is held, not earned, and goes back with the book", async () => {
    const lent = await lend();
    expect(lent).toMatchObject({ depositAmount: 500000, depositMethod: "cash", depositState: "held" });
    expect(await balanceOf("1110")).toBe(500000);
    expect(await balanceOf("2400")).toBe(-500000);

    expect(await close(lent.id, "returned")).toMatchObject({ depositState: "returned" });
    expect(await balanceOf("1110")).toBe(0);
    expect(await balanceOf("2400")).toBe(0);
    await expectBooksBalance();
  });

  it("is kept as income for a lost book, and handed back if it turns up", async () => {
    const lent = await lend();

    expect(await close(lent.id, "lost")).toMatchObject({ depositState: "kept" });
    expect(await balanceOf("2400")).toBe(0);
    expect(await balanceOf("4900")).toBe(-500000);
    expect(await balanceOf("1110")).toBe(500000);

    expect(await close(lent.id, "returned")).toMatchObject({ depositState: "returned" });
    expect(await balanceOf("4900")).toBe(0);
    expect(await balanceOf("1110")).toBe(0);
    await expectBooksBalance();
  });

  it("asks how a deposit was paid", async () => {
    signInAs("staff");
    const response = await lendBook(
      jsonRequest("POST", "/api/admin/book-loans", { ...loan, depositMethod: undefined }),
    );

    expect(response.status).toBe(400);
    expect((await readError(response)).fieldErrors).toMatchObject({ depositMethod: "paymentInvalid" });
  });
});

describe("paying a bill in parts", () => {
  async function bill(): Promise<Expense> {
    signInAs("admin");
    const response = await recordExpense(
      jsonRequest("POST", "/api/admin/expenses", {
        date: today,
        supplierId: "",
        accountCode: "6100",
        description: "Rent",
        amount: "1000000",
        vatAmount: "",
        payment: "unpaid",
      }),
    );
    expect(response.status).toBe(201);
    return readJson<Expense>(response);
  }

  async function pay(id: string, amount: string): Promise<Response> {
    return payExpense(
      jsonRequest("POST", `/api/admin/expenses/${id}/pay`, { source: "bank", paidOn: today, amount }),
      routeParams({ id }),
    );
  }

  it("stays owed until the last of it is paid", async () => {
    const expense = await bill();

    const part = await readJson<Expense>(await pay(expense.id, "300000"));
    expect(part).toMatchObject({ status: "unpaid", paidAmount: 300000 });
    expect(await balanceOf("2100")).toBe(-700000);
    expect(await balanceOf("1120")).toBe(-300000);

    const rest = await readJson<Expense>(await pay(expense.id, ""));
    expect(rest).toMatchObject({ status: "paid", paidAmount: 1000000, paidFrom: "bank" });
    expect(await balanceOf("2100")).toBe(0);
    expect(await balanceOf("1120")).toBe(-1000000);
    await expectBooksBalance();
  });

  it("refuses paying more than is owed", async () => {
    const expense = await bill();
    await pay(expense.id, "300000");

    const response = await pay(expense.id, "700001");
    expect(response.status).toBe(400);
    expect((await readError(response)).fieldErrors).toMatchObject({ amount: "paymentOverOwed" });
  });
});
