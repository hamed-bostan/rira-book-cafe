import { describe, expect, it } from "vitest";

import { GET as accountingReport } from "@/app/api/admin/accounting/reports/[report]/route";
import { PATCH as changeLoan } from "@/app/api/admin/book-loans/[id]/route";
import { POST as lend } from "@/app/api/admin/book-loans/route";
import { POST as refundRegistration } from "@/app/api/admin/events/[id]/registrations/[registrationId]/refunds/route";
import { POST as recordIncome } from "@/app/api/admin/income/route";
import { PATCH as setPayment } from "@/app/api/admin/orders/[id]/payment/route";
import { POST as refundOrder } from "@/app/api/admin/orders/[id]/refunds/route";
import { PATCH as changeStatus } from "@/app/api/admin/orders/[id]/status/route";
import { POST as ringUpSale } from "@/app/api/admin/orders/route";
import { GET as exportTable } from "@/app/api/admin/reports/export/[table]/route";
import { GET as paymentReport } from "@/app/api/admin/reports/payments/route";
import { GET as salesReport } from "@/app/api/admin/reports/sales/route";
import { PATCH as settleDeposit, POST as takeDeposit } from "@/app/api/admin/reservations/[id]/deposit/route";
import { POST as refundStay } from "@/app/api/admin/suite-bookings/[id]/refunds/route";
import { POST as placeOrder } from "@/app/api/orders/route";
import type { ProfitAndLoss } from "@/src/domain/entities/AccountingReports";
import type { PaymentReport, RevenueStream, RevenueStreamKey, SalesReport } from "@/src/domain/entities/Analytics";
import type { BookLoan } from "@/src/domain/entities/BookLoan";
import { cafeDayOf, shiftCafeDay } from "@/src/domain/entities/CafeTime";
import type { Order } from "@/src/domain/entities/Order";
import { prisma } from "@/src/infrastructure/prisma/client";

import { TEST_USERS } from "../fixtures/users";

import { getRequest, jsonRequest, readJson, routeParams } from "./helpers/http";
import { signInAs } from "./helpers/session";

const today = cafeDayOf(new Date());
const EVENT = "seed-event-book-club";
const BOOK = "seed-book-blind-owl";

async function sales(query: string): Promise<SalesReport> {
  signInAs("admin");
  const response = await salesReport(getRequest(`/api/admin/reports/sales?${query}`));
  expect(response.status).toBe(200);
  return readJson<SalesReport>(response);
}

async function payments(query: string): Promise<PaymentReport> {
  signInAs("admin");
  const response = await paymentReport(getRequest(`/api/admin/reports/payments?${query}`));
  expect(response.status).toBe(200);
  return readJson<PaymentReport>(response);
}

async function profitAndLoss(fromDay: string, toDay: string): Promise<ProfitAndLoss> {
  signInAs("admin");
  const response = await accountingReport(
    getRequest(`/api/admin/accounting/reports/profit-and-loss?from=${fromDay}&to=${toDay}`),
    routeParams({ report: "profit-and-loss" }),
  );
  expect(response.status).toBe(200);
  return readJson<ProfitAndLoss>(response);
}

/** A counter sale of two espressos (190,000), paid in cash and handed over on the spot. */
async function counterSale(): Promise<Order> {
  signInAs("staff");
  const response = await ringUpSale(
    jsonRequest("POST", "/api/admin/orders", {
      items: [{ productId: "seed-espresso", quantity: 2 }],
      serviceType: "takeaway",
      customerPhone: "0912 555 0110",
      customerName: "Nima Rad",
      paymentParts: [{ method: "cash", amount: 190000 }],
      complete: true,
    }),
  );
  expect(response.status).toBe(201);
  return readJson<Order>(response);
}

async function refundOne(order: Order, method = "cash"): Promise<number> {
  signInAs("admin");
  const response = await refundOrder(
    jsonRequest("POST", `/api/admin/orders/${order.id}/refunds`, {
      lines: [{ itemId: order.items[0].id, quantity: 1, restock: false }],
      method,
    }),
    routeParams({ id: order.id }),
  );
  expect(response.status).toBe(201);
  return (await readJson<{ refund: { amount: number } }>(response)).refund.amount;
}

async function income(body: Record<string, unknown>): Promise<void> {
  signInAs("admin");
  const response = await recordIncome(
    jsonRequest("POST", "/api/admin/income", { date: today, method: "cash", payerName: "Sara", ...body }),
  );
  expect(response.status).toBe(201);
}

const stream = (report: { streams: RevenueStream[] }, key: RevenueStreamKey): RevenueStream => {
  const row = report.streams.find((candidate) => candidate.stream === key);
  if (!row) throw new Error(`no ${key} stream`);
  return row;
};

/** A P&L section's balance on the given accounts. */
const booked = (pl: ProfitAndLoss, codes: readonly string[]): number =>
  pl.revenue.rows.filter((row) => codes.includes(row.account.code)).reduce((sum, row) => sum + row.balance, 0);

describe("discounts and the walk from gross sales to revenue", () => {
  it("takes promo codes, points and refunds off gross sales, and lists each code", async () => {
    await prisma.promoCode.create({ data: { code: "ODDSAVE", kind: "fixed", value: 10001 } });
    await prisma.loyaltyTransaction.create({ data: { userId: TEST_USERS.customer.id, delta: 77, reason: "adjust" } });

    signInAs("customer");
    const placed = await placeOrder(
      jsonRequest("POST", "/api/orders", {
        items: [
          { productId: "seed-espresso", quantity: 2 },
          { productId: "seed-carrot-cake", quantity: 1 },
        ],
        serviceType: "takeaway",
        promoCode: "oddsave",
        redeemPoints: true,
      }),
    );
    expect(placed.status).toBe(201);
    const order = await readJson<Order>(placed);
    signInAs("staff");
    for (const status of ["preparing", "completed"]) {
      await changeStatus(
        jsonRequest("PATCH", `/api/admin/orders/${order.id}/status`, { status }),
        routeParams({ id: order.id }),
      );
    }
    await setPayment(
      jsonRequest("PATCH", `/api/admin/orders/${order.id}/payment`, { paymentStatus: "paid", paymentMethod: "card" }),
      routeParams({ id: order.id }),
    );
    await counterSale();
    const back = await refundOne(order, "card");

    const report = await sales("range=7d");
    const gross = order.subtotal + 190000;
    const charged = order.total + 190000;
    expect(report.bridge.map((line) => [line.key, line.amount])).toEqual([
      ["grossSales", gross],
      ["promoDiscount", -10001],
      ["pointsDiscount", -77000],
      ["charged", charged],
      ["refunds", -back],
      ["revenue", charged - back],
    ]);
    expect(report.summary.revenue).toBe(charged - back);
    expect(report.discounts.summary).toMatchObject({
      promoOrders: 1,
      promoDiscount: 10001,
      pointsOrders: 1,
      pointsDiscount: 77000,
      pointsRedeemed: 77,
    });
    expect(report.discounts.byCode).toEqual([
      { code: "ODDSAVE", uses: 1, discount: 10001, revenue: order.total - back },
    ]);
  });
});

describe("counting refunds on the day they happened", () => {
  it("leaves an old order's period alone and takes the refund off today", async () => {
    const order = await counterSale();
    const back = await refundOne(order);
    // The order was placed (and completed) ten days ago; the refund is today's.
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    await prisma.order.update({ where: { id: order.id }, data: { placedAt: tenDaysAgo } });

    const byOrder = await sales("range=7d");
    expect(byOrder.summary.revenue).toBe(0);
    expect(byOrder.summary.refunds).toBe(0);

    const byRefund = await sales("range=7d&refunds=refundDay");
    expect(byRefund.refunds).toBe("refundDay");
    expect(byRefund.summary).toMatchObject({ charged: 0, refunds: back, revenue: -back, itemsSold: -1 });
    expect(byRefund.daily.find((day) => day.day === today)?.revenue).toBe(-back);
    expect(byRefund.byKind.reduce((sum, row) => sum + row.revenue, 0)).toBe(-back);
    expect(byRefund.topItems).toMatchObject([{ productId: "seed-espresso", quantity: -1, revenue: -back }]);
    expect(stream(byRefund, "cafe")).toMatchObject({ received: 0, refunded: back });

    // Its own period, counted the same way, keeps the whole sale.
    const then = cafeDayOf(tenDaysAgo);
    const thatDay = await sales(`from=${then}&to=${then}&refunds=refundDay`);
    expect(thatDay.summary.revenue).toBe(190000);

    const paid = await payments("range=7d&refunds=refundDay");
    expect(paid.summary.paidValue).toBe(-back);
    expect(paid.byMethod).toEqual([{ method: "cash", orders: 0, value: -back }]);
  });
});

describe("revenue by stream", () => {
  /** A day of everything the cafe earns from, with refunds, all booked today. */
  async function aBusyDay(): Promise<void> {
    // Cafe: two sales, one espresso refunded.
    const order = await counterSale();
    await counterSale();
    await refundOne(order);

    // Suite: a payment with VAT, part of it handed back.
    const stay = await prisma.suiteBooking.create({
      data: {
        guestName: "Kian",
        guestPhone: "09127770000",
        guests: 2,
        checkIn: new Date(`${shiftCafeDay(today, 3)}T00:00:00.000Z`),
        checkOut: new Date(`${shiftCafeDay(today, 5)}T00:00:00.000Z`),
        status: "confirmed",
        nightRate: BigInt(2000000),
      },
    });
    await income({
      accountCode: "4500",
      description: "Suite stay",
      amount: "4400000",
      vatAmount: "400000",
      sourceType: "suiteBooking",
      sourceId: stay.id,
    });
    signInAs("admin");
    const stayRefund = await refundStay(
      jsonRequest("POST", `/api/admin/suite-bookings/${stay.id}/refunds`, {
        amount: "1100000",
        method: "cash",
        reason: "",
      }),
      routeParams({ id: stay.id }),
    );
    expect(stayRefund.status).toBe(201);

    // Events: two tickets, one handed back.
    const registration = await prisma.eventRegistration.create({
      data: { eventId: EVENT, userId: "09120000004", guestName: "Test Guest", guestPhone: "09120000004", seats: 2 },
    });
    await income({
      accountCode: "4400",
      description: "Book club × 2",
      amount: "300000",
      vatAmount: "",
      sourceType: "eventRegistration",
      sourceId: registration.id,
    });
    signInAs("admin");
    const ticketBack = await refundRegistration(
      jsonRequest("POST", `/api/admin/events/${EVENT}/registrations/${registration.id}/refunds`, {
        amount: "150000",
        method: "cash",
        reason: "",
      }),
      routeParams({ id: EVENT, registrationId: registration.id }),
    );
    expect(ticketBack.status).toBe(201);

    // Other income: bank interest, with no booking behind it.
    await income({ accountCode: "4800", description: "Interest", amount: "25000", vatAmount: "" });

    // A no-show's table deposit, kept.
    const booking = await prisma.reservation.create({
      data: {
        guestName: "Neda",
        guestPhone: "09125550000",
        partySize: 8,
        startsAt: new Date(Date.now() + 60 * 60 * 1000),
        durationMinutes: 90,
        status: "seated",
        tableLabel: "T1",
      },
    });
    signInAs("staff");
    const taken = await takeDeposit(
      jsonRequest("POST", `/api/admin/reservations/${booking.id}/deposit`, { amount: "300000", method: "cash" }),
      routeParams({ id: booking.id }),
    );
    expect(taken.status).toBe(200);
    await prisma.reservation.update({ where: { id: booking.id }, data: { status: "noShow" } });
    signInAs("admin");
    const kept = await settleDeposit(
      jsonRequest("PATCH", `/api/admin/reservations/${booking.id}/deposit`, { settle: "kept" }),
      routeParams({ id: booking.id }),
    );
    expect(kept.status).toBe(200);
  }

  /** A book lent with a deposit and lost, so the deposit is kept. */
  async function aLostBook(): Promise<BookLoan> {
    signInAs("admin");
    const lent = await lend(
      jsonRequest("POST", "/api/admin/book-loans", {
        productId: BOOK,
        borrowerName: "Sara",
        borrowerPhone: "09121234567",
        dueOn: shiftCafeDay(today, 14),
        note: "",
        depositAmount: "200000",
        depositMethod: "cash",
      }),
    );
    expect(lent.status).toBe(201);
    const loan = await readJson<BookLoan>(lent);
    const lost = await changeLoan(
      jsonRequest("PATCH", `/api/admin/book-loans/${loan.id}`, { status: "lost" }),
      routeParams({ id: loan.id }),
    );
    expect(lost.status).toBe(200);
    return loan;
  }

  it("reads each stream from its own records, refunds and VAT netted", async () => {
    await aBusyDay();
    await aLostBook();

    const report = await sales("range=today");
    expect(stream(report, "cafe")).toMatchObject({ received: 380000, refunded: 95000, revenue: 285000 });
    expect(stream(report, "suite")).toMatchObject({
      received: 4400000,
      refunded: 1100000,
      revenue: 3300000,
      vat: 300000,
      revenueExVat: 3000000,
    });
    expect(stream(report, "events")).toMatchObject({ received: 300000, refunded: 150000, revenue: 150000, vat: 0 });
    expect(stream(report, "otherIncome")).toMatchObject({ revenue: 25000 });
    expect(stream(report, "tableDeposits")).toMatchObject({ received: 300000, revenue: 300000, vat: 0 });
    expect(stream(report, "bookDeposits")).toMatchObject({ received: 200000, revenue: 200000 });
    // The cafe's revenue stream is the sales report's revenue.
    expect(stream(report, "cafe").revenue).toBe(report.summary.revenue);
    // A deposit is never part of an order, so the orders' revenue holds none of it.
    expect(report.summary.revenue).toBe(285000);
  });

  it("matches what the profit and loss statement books for each stream", async () => {
    await aBusyDay();
    const loan = await aLostBook();

    for (const timing of ["refundDay", "orderDay"] as const) {
      const [report, pl] = await Promise.all([sales(`range=today&refunds=${timing}`), profitAndLoss(today, today)]);
      expect(stream(report, "cafe").revenueExVat).toBe(booked(pl, ["4100", "4200", "4300"]));
      expect(stream(report, "suite").revenueExVat).toBe(booked(pl, ["4500"]));
      expect(stream(report, "events").revenueExVat).toBe(booked(pl, ["4400"]));
      expect(stream(report, "otherIncome").revenueExVat).toBe(booked(pl, ["4800"]));
      expect(stream(report, "tableDeposits").revenueExVat + stream(report, "bookDeposits").revenueExVat).toBe(
        booked(pl, ["4900"]),
      );
      expect(report.streams.reduce((sum, row) => sum + row.revenueExVat, 0)).toBe(pl.revenue.total);
    }

    // The lost book turns up: its deposit goes back, on both sides.
    signInAs("admin");
    const found = await changeLoan(
      jsonRequest("PATCH", `/api/admin/book-loans/${loan.id}`, { status: "returned" }),
      routeParams({ id: loan.id }),
    );
    expect(found.status).toBe(200);
    const [report, pl] = await Promise.all([sales("range=today&refunds=refundDay"), profitAndLoss(today, today)]);
    expect(stream(report, "bookDeposits")).toMatchObject({ received: 200000, refunded: 200000, revenue: 0 });
    expect(report.streams.reduce((sum, row) => sum + row.revenueExVat, 0)).toBe(pl.revenue.total);

    // The payments report splits the same VAT.
    const paid = await payments("range=today&refunds=refundDay");
    expect(paid.streams).toEqual(report.streams);
    expect(stream(paid, "cafe").vat).toBeGreaterThan(0);
  });
});

describe("the payments report against the period before", () => {
  it("compares what was paid, method by method", async () => {
    const old = await counterSale();
    await prisma.order.update({
      where: { id: old.id },
      data: { placedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) },
    });
    await counterSale();
    await counterSale();

    const report = await payments("range=7d");
    expect(report.summary.paidValue).toBe(380000);
    expect(report.previousSummary.paidValue).toBe(190000);
    expect(report.previousByMethod).toEqual([{ method: "cash", orders: 1, value: 190000 }]);
  });
});

describe("exporting a report's table", () => {
  const download = (slug: string, query: string): Promise<Response> =>
    exportTable(getRequest(`/api/admin/reports/export/${slug}?${query}`), routeParams({ table: slug }));

  it("is for whoever reads the reports", async () => {
    expect((await download("sales-by-day", "")).status).toBe(401);
    signInAs("staff");
    expect((await download("sales-by-day", "")).status).toBe(401);
    signInAs("admin");
    expect((await download("secrets", "")).status).toBe(404);
    expect((await download("sales-by-day", "refunds=whenever")).status).toBe(400);
  });

  it("downloads the table whole, as an Excel-ready file", async () => {
    await counterSale();
    signInAs("admin");
    const response = await download("streams", "range=today&locale=fa");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(response.headers.get("content-disposition")).toBe(`attachment; filename="streams-${today}-to-${today}.csv"`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    // The UTF-8 byte-order mark Excel needs to read Persian (`text()` would strip it).
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const csv = new TextDecoder().decode(bytes);
    expect(csv).toContain("سفارش‌های کافه,190000,0,190000");

    const items = await (await download("top-items", "range=today")).text();
    expect(items).toContain("Espresso");
  });
});
