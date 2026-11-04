import { describe, expect, it } from "vitest";

import { GET as getReport } from "@/app/api/admin/accounting/reports/[report]/route";
import { POST as closeShift } from "@/app/api/admin/cash-shifts/[id]/close/route";
import { GET as readShifts, POST as openShift } from "@/app/api/admin/cash-shifts/route";
import { POST as recordExpense } from "@/app/api/admin/expenses/route";
import { POST as recordIncome } from "@/app/api/admin/income/route";
import { GET as getInventory } from "@/app/api/admin/inventory/route";
import { POST as refundOrder } from "@/app/api/admin/orders/[id]/refunds/route";
import { POST as ringUpSale } from "@/app/api/admin/orders/route";
import { GET as paymentReport } from "@/app/api/admin/reports/payments/route";
import { GET as salesReport } from "@/app/api/admin/reports/sales/route";
import type { BalanceSheet, ProfitAndLoss, TrialBalance } from "@/src/domain/entities/AccountingReports";
import type { PaymentReport, SalesReport } from "@/src/domain/entities/Analytics";
import { cafeDayOf } from "@/src/domain/entities/CafeTime";
import type { CashShift } from "@/src/domain/entities/CashShift";
import type { InventorySummary } from "@/src/domain/entities/Inventory";
import type { Order } from "@/src/domain/entities/Order";
import { prisma } from "@/src/infrastructure/prisma/client";

import { getRequest, jsonRequest, readJson, routeParams } from "./helpers/http";
import { signInAs } from "./helpers/session";

/**
 * One business day across the dashboard, checked module against module: a till
 * shift opened, sales in cash and by card, a cash refund, a bill paid from the
 * drawer and income taken in cash, the shift closed — then the drawer, the sales
 * and payment reports, the profit and loss, the trial balance and the stock value
 * must all tell the same story.
 */

const today = cafeDayOf(new Date());
const GUEST = { customerPhone: "0912 555 0150", customerName: "Parisa Navabi" };
const FLOAT = 500_000;

async function report<T>(name: string): Promise<T> {
  signInAs("admin");
  const query = name === "trial-balance" || name === "balance-sheet" ? `asOf=${today}` : `from=${today}&to=${today}`;
  const response = await getReport(
    getRequest(`/api/admin/accounting/reports/${name}?${query}`),
    routeParams({ report: name }),
  );
  expect(response.status).toBe(200);
  return readJson<T>(response);
}

/** Net debits − credits on an account, across everything posted. */
async function balanceOf(accountCode: string): Promise<number> {
  const sum = await prisma.journalLine.aggregate({ where: { accountCode }, _sum: { debit: true, credit: true } });
  return Number(sum._sum.debit ?? 0) - Number(sum._sum.credit ?? 0);
}

async function sale(productId: string, quantity: number, method: "cash" | "card"): Promise<Order> {
  signInAs("staff");
  // Priced on the server first, so the payment can be for exactly the total.
  const placed = await ringUpSale(
    jsonRequest("POST", "/api/admin/orders", {
      items: [{ productId, quantity }],
      serviceType: "takeaway",
      ...GUEST,
      complete: true,
    }),
  );
  expect(placed.status).toBe(201);
  const order = await readJson<Order>(placed);
  const { PATCH: setPayment } = await import("@/app/api/admin/orders/[id]/payment/route");
  const paid = await setPayment(
    jsonRequest("PATCH", `/api/admin/orders/${order.id}/payment`, { paymentStatus: "paid", paymentMethod: method }),
    routeParams({ id: order.id }),
  );
  expect(paid.status).toBe(200);
  return readJson<Order>(paid);
}

describe("a business day", () => {
  it("ties the drawer, the reports, the books and the stock together", async () => {
    const cashBefore = await balanceOf("1110");

    signInAs("staff");
    const opened = await openShift(jsonRequest("POST", "/api/admin/cash-shifts", { openingFloat: FLOAT, note: "" }));
    expect(opened.status).toBe(201);
    const shift = await readJson<CashShift>(opened);

    // The day's trade.
    const cashSale = await sale("seed-espresso", 3, "cash");
    const cardSale = await sale("seed-cappuccino", 2, "card");
    signInAs("admin");
    const refunded = await refundOrder(
      jsonRequest("POST", `/api/admin/orders/${cashSale.id}/refunds`, {
        lines: [{ itemId: cashSale.items[0].id, quantity: 1, restock: false }],
        method: "cash",
        reason: "Spilled",
      }),
      routeParams({ id: cashSale.id }),
    );
    expect(refunded.status).toBe(201);
    const refundAmount = cashSale.total / 3;
    const bill = await recordExpense(
      jsonRequest("POST", "/api/admin/expenses", {
        date: today,
        supplierId: "",
        accountCode: "6400",
        description: "Napkins from the corner shop",
        amount: "120000",
        vatAmount: "",
        payment: "cash",
      }),
    );
    expect(bill.status).toBe(201);
    const roomHire = await recordIncome(
      jsonRequest("POST", "/api/admin/income", {
        date: today,
        payerName: "Book club",
        description: "Room hire",
        accountCode: "4900",
        amount: "300000",
        vatAmount: "",
        method: "cash",
      }),
    );
    expect(roomHire.status).toBe(201);

    // The drawer: the float, plus every cash movement of the day, worked out by hand.
    const expectedCash = FLOAT + cashSale.total - refundAmount - 120_000 + 300_000;
    signInAs("staff");
    const { current } = await readJson<{ current: CashShift & { expectedCash: number } }>(await readShifts());
    expect(current.expectedCash).toBe(expectedCash);
    const closed = await closeShift(
      jsonRequest("POST", `/api/admin/cash-shifts/${shift.id}/close`, { countedCash: expectedCash, note: "" }),
      routeParams({ id: shift.id }),
    );
    expect(closed.status).toBe(200);
    expect(await readJson<CashShift>(closed)).toMatchObject({ expectedCash, countedCash: expectedCash, difference: 0 });
    // A drawer that balances posts no over/short, and the cash account moved by exactly the drawer's takings.
    expect(await prisma.journalEntry.count({ where: { source: "cashShift" } })).toBe(0);
    expect((await balanceOf("1110")) - cashBefore).toBe(expectedCash - FLOAT);

    // The sales report's revenue streams and the P&L read the same day from different
    // records (orders and income vs the journal); net of VAT they must agree.
    signInAs("admin");
    const sales = await readJson<SalesReport>(
      await salesReport(getRequest(`/api/admin/reports/sales?from=${today}&to=${today}`)),
    );
    const pnl = await report<ProfitAndLoss>("profit-and-loss");
    const streamsExVat = sales.streams.reduce((sum, stream) => sum + stream.revenueExVat, 0);
    expect(streamsExVat).toBe(pnl.revenue.total);

    // The payments report: what was paid, by method, is what the two sales were paid.
    const payments = await readJson<PaymentReport>(
      await paymentReport(getRequest(`/api/admin/reports/payments?from=${today}&to=${today}`)),
    );
    const byMethod = Object.fromEntries(payments.byMethod.map((row) => [row.method, row.value]));
    expect(byMethod.card).toBe(cardSale.total);
    expect(payments.summary.paidOrders).toBe(2);

    // The books balance, and the stock on the shelves is worth what the books say.
    expect((await report<TrialBalance>("trial-balance")).balanced).toBe(true);
    expect((await report<BalanceSheet>("balance-sheet")).balanced).toBe(true);
    const stock = await readJson<InventorySummary>(await getInventory());
    expect(stock.difference).toBe(0);
  });
});
