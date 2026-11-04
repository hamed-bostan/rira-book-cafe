import { describe, expect, it, vi } from "vitest";

import {
  dayRange,
  presetRange,
  type DateRange,
  type DiscountSummary,
  type PaymentSummary,
  type SalesSummary,
  type StreamTotals,
} from "../../../entities/Analytics";
import {
  EXPORT_ROWS_LIMIT,
  GetDashboardOverview,
  GetGuestReport,
  GetPaymentReport,
  GetReportTable,
  GetSalesReport,
  PROMO_CODES_LIMIT,
  TOP_ITEMS_LIMIT,
} from "../Reports";

import type { IAnalyticsRepository } from "../../../repositories/IAnalyticsRepository";

const EMPTY: SalesSummary = {
  revenue: 0,
  grossSales: 0,
  promoDiscount: 0,
  pointsDiscount: 0,
  charged: 0,
  refunds: 0,
  orders: 0,
  itemsSold: 0,
  averageOrderValue: 0,
  cancelledOrders: 0,
  cancelledValue: 0,
};

const NO_DISCOUNTS: DiscountSummary = {
  promoOrders: 0,
  promoDiscount: 0,
  pointsOrders: 0,
  pointsDiscount: 0,
  pointsRedeemed: 0,
  pointsEarned: 0,
};

const PAYMENTS: PaymentSummary = { revenue: 0, paidOrders: 0, paidValue: 0, unpaidOrders: 0, unpaidValue: 0 };

/** 12:30 UTC on Oct 21 is 16:00 on Oct 21 in Tehran. */
const NOW = new Date("2026-10-21T12:30:00Z");
const WEEK = dayRange("2026-10-15", "2026-10-21");

function repo(overrides: Partial<IAnalyticsRepository> = {}): IAnalyticsRepository {
  return {
    salesSummary: vi.fn(async () => EMPTY),
    dailySales: vi.fn(async () => []),
    hourlySales: vi.fn(async () => []),
    salesByKind: vi.fn(async () => []),
    topItems: vi.fn(async () => []),
    discountSummary: vi.fn(async () => NO_DISCOUNTS),
    promoCodeUsage: vi.fn(async () => []),
    revenueStreams: vi.fn(async () => []),
    paymentSummary: vi.fn(async () => PAYMENTS),
    paidByMethod: vi.fn(async () => []),
    unpaidOrders: vi.fn(async () => []),
    guestCounts: vi.fn(),
    topGuests: vi.fn(async () => []),
    reservationStats: vi.fn(),
    reservationsOn: vi.fn(async () => ({ bookings: 2, covers: 6, awaitingConfirmation: 1 })),
    publishedEventsDuring: vi.fn(async () => 1),
    ...overrides,
  };
}

describe("GetSalesReport", () => {
  it("compares with the previous period and fills the series", async () => {
    const salesSummary = vi.fn(async () => EMPTY);
    const report = await new GetSalesReport(repo({ salesSummary })).execute(
      { range: WEEK, refunds: "orderDay", sort: "revenue" },
      NOW,
    );

    expect(report.previousRange).toMatchObject({ fromDay: "2026-10-08", toDay: "2026-10-14" });
    expect(salesSummary).toHaveBeenCalledTimes(2);
    expect(report.daily).toHaveLength(7);
    expect(report.hourly).toHaveLength(24);
    expect(report.refunds).toBe("orderDay");
  });

  it("compares today with yesterday up to the same time", async () => {
    const salesSummary = vi.fn(async (_range: DateRange) => EMPTY);
    const report = await new GetSalesReport(repo({ salesSummary })).execute(
      { range: presetRange("today", NOW), refunds: "orderDay", sort: "revenue" },
      NOW,
    );

    expect(report.previousRange).toMatchObject({ fromDay: "2026-10-20", toDay: "2026-10-20" });
    // Yesterday from its start to 16:00 — not the whole day.
    const compared = salesSummary.mock.calls[1]?.[0];
    expect(compared?.from.toISOString()).toBe("2026-10-19T20:30:00.000Z");
    expect(compared?.to.toISOString()).toBe("2026-10-20T12:30:00.000Z");
  });

  it("names each best seller's category in the reader's language", async () => {
    const item = {
      productId: "p1",
      name: "Cappuccino",
      kind: "drink" as const,
      categoryName: "قهوه",
      quantity: 14,
      revenue: 1680000,
    };
    const topItems = vi.fn(async () => [item]);
    const report = await new GetSalesReport(repo({ topItems })).execute(
      { range: WEEK, refunds: "refundDay", sort: "quantity" },
      NOW,
      "fa",
    );

    expect(topItems).toHaveBeenCalledWith(WEEK, "refundDay", "quantity", TOP_ITEMS_LIMIT, "fa");
    expect(report.topItems).toEqual([item]);
  });

  it("passes the refund timing to every figure refunds move", async () => {
    const overrides = {
      salesSummary: vi.fn(async () => EMPTY),
      dailySales: vi.fn(async () => []),
      hourlySales: vi.fn(async () => []),
      salesByKind: vi.fn(async () => []),
      revenueStreams: vi.fn(async () => []),
    };
    await new GetSalesReport(repo(overrides)).execute({ range: WEEK, refunds: "refundDay", sort: "revenue" }, NOW);

    for (const method of Object.values(overrides)) {
      expect(method).toHaveBeenCalledWith(expect.anything(), "refundDay");
    }
  });

  it("walks from gross sales to revenue and compares discounts with the period before", async () => {
    const current: SalesSummary = {
      ...EMPTY,
      grossSales: 1000,
      promoDiscount: 100,
      pointsDiscount: 50,
      charged: 850,
      refunds: 30,
      revenue: 820,
    };
    const salesSummary = vi.fn(async (range: DateRange) => (range.fromDay === WEEK.fromDay ? current : EMPTY));
    const discountSummary = vi.fn(async (range: DateRange) =>
      range.fromDay === WEEK.fromDay ? { ...NO_DISCOUNTS, promoDiscount: 100 } : { ...NO_DISCOUNTS, promoDiscount: 40 },
    );
    const promoCodeUsage = vi.fn(async () => [{ code: "SPRING", uses: 2, discount: 100, revenue: 700 }]);

    const report = await new GetSalesReport(repo({ salesSummary, discountSummary, promoCodeUsage })).execute(
      { range: WEEK, refunds: "orderDay", sort: "revenue" },
      NOW,
    );

    expect(report.bridge.map((line) => [line.key, line.amount])).toEqual([
      ["grossSales", 1000],
      ["promoDiscount", -100],
      ["pointsDiscount", -50],
      ["charged", 850],
      ["refunds", -30],
      ["revenue", 820],
    ]);
    expect(report.discounts.summary.promoDiscount).toBe(100);
    expect(report.discounts.previousSummary.promoDiscount).toBe(40);
    expect(promoCodeUsage).toHaveBeenCalledWith(WEEK, PROMO_CODES_LIMIT);
    expect(report.discounts.byCode).toHaveLength(1);
  });

  it("lists every revenue stream, with the period before beside it", async () => {
    const revenueStreams = vi.fn(async (range: DateRange): Promise<StreamTotals[]> =>
      range.fromDay === WEEK.fromDay
        ? [{ stream: "suite", received: 3000, refunded: 1000, vat: 200, vatRefunded: 100 }]
        : [{ stream: "suite", received: 500, refunded: 0, vat: 0, vatRefunded: 0 }],
    );
    const report = await new GetSalesReport(repo({ revenueStreams })).execute(
      { range: WEEK, refunds: "orderDay", sort: "revenue" },
      NOW,
    );

    expect(report.streams.map((row) => row.stream)).toEqual([
      "cafe",
      "suite",
      "events",
      "tableDeposits",
      "bookDeposits",
      "otherIncome",
    ]);
    expect(report.streams[1]).toEqual({
      stream: "suite",
      received: 3000,
      refunded: 1000,
      revenue: 2000,
      vat: 100,
      revenueExVat: 1900,
      previousRevenue: 500,
    });
  });
});

describe("GetPaymentReport", () => {
  it("says how the paid orders came in beside the unpaid ones, against the period before", async () => {
    const byMethod = [{ method: "cash" as const, orders: 3, value: 450000 }];
    const previousByMethod = [{ method: "card" as const, orders: 1, value: 90000 }];
    const summary = { revenue: 450000, paidOrders: 3, paidValue: 450000, unpaidOrders: 1, unpaidValue: 120000 };
    const previousSummary = { ...summary, paidValue: 90000 };
    const isThisWeek = (range: DateRange): boolean => range.fromDay === WEEK.fromDay;
    const report = await new GetPaymentReport(
      repo({
        paymentSummary: vi.fn(async (range: DateRange) => (isThisWeek(range) ? summary : previousSummary)),
        paidByMethod: vi.fn(async (range: DateRange) => (isThisWeek(range) ? byMethod : previousByMethod)),
        unpaidOrders: vi.fn(async () => []),
      }),
    ).execute({ range: WEEK, refunds: "orderDay" }, NOW);

    expect(report.summary).toEqual(summary);
    expect(report.previousSummary).toEqual(previousSummary);
    expect(report.byMethod).toEqual(byMethod);
    expect(report.previousByMethod).toEqual(previousByMethod);
    expect(report.unpaid).toEqual([]);
    expect(report.streams).toHaveLength(6);
    expect(report.previousRange).toMatchObject({ fromDay: "2026-10-08", toDay: "2026-10-14" });
  });
});

describe("GetReportTable", () => {
  it("reads a table whole, not capped to what the screen shows", async () => {
    const topItems = vi.fn(async () => []);
    const topGuests = vi.fn(async () => []);
    const unpaidOrders = vi.fn(async () => []);
    const tables = new GetReportTable(repo({ topItems, topGuests, unpaidOrders }));
    const query = { range: WEEK, refunds: "orderDay" as const, sort: "revenue" as const };

    expect(await tables.execute("topItems", query, NOW, "fa")).toEqual({ table: "topItems", rows: [] });
    expect(topItems).toHaveBeenCalledWith(WEEK, "orderDay", "revenue", EXPORT_ROWS_LIMIT, "fa");
    await tables.execute("guests", query, NOW);
    expect(topGuests).toHaveBeenCalledWith(WEEK, EXPORT_ROWS_LIMIT);
    await tables.execute("unpaidOrders", query, NOW);
    expect(unpaidOrders).toHaveBeenCalledWith(WEEK, EXPORT_ROWS_LIMIT);
  });

  it("fills the days and compares the streams, as the screen does", async () => {
    const tables = new GetReportTable(repo());
    const query = { range: WEEK, refunds: "refundDay" as const, sort: "revenue" as const };

    const days = await tables.execute("salesByDay", query, NOW);
    expect(days.rows).toHaveLength(7);
    const streams = await tables.execute("streams", query, NOW);
    expect(streams.rows).toHaveLength(6);
    expect((await tables.execute("discounts", query, NOW)).table).toBe("discounts");
    expect((await tables.execute("paymentsByMethod", query, NOW)).table).toBe("paymentsByMethod");
  });
});

describe("GetGuestReport", () => {
  it("counts the period before for the comparison", async () => {
    const guestCounts = vi.fn(async (range: DateRange) => ({
      guests: range.fromDay === "2026-10-15" ? 12 : 8,
      newGuests: 0,
      returningGuests: 0,
      repeatRate: 0,
    }));
    const report = await new GetGuestReport(
      repo({
        guestCounts,
        topGuests: vi.fn(async () => []),
        reservationStats: vi.fn(async () => ({ total: 0, covers: 0, noShows: 0, noShowRate: 0 })),
      }),
    ).execute(WEEK, NOW);

    expect(report.previousRange).toMatchObject({ fromDay: "2026-10-08", toDay: "2026-10-14" });
    expect(report.guests).toBe(12);
    expect(report.previousGuests).toBe(8);
  });

  it("counts today's guests against yesterday at this time", async () => {
    const guestCounts = vi.fn(async (_range: DateRange) => ({
      guests: 0,
      newGuests: 0,
      returningGuests: 0,
      repeatRate: 0,
    }));
    await new GetGuestReport(
      repo({
        guestCounts,
        topGuests: vi.fn(async () => []),
        reservationStats: vi.fn(async () => ({ total: 0, covers: 0, noShows: 0, noShowRate: 0 })),
      }),
    ).execute(presetRange("today", NOW), NOW);

    expect(guestCounts.mock.calls[1]?.[0].to.toISOString()).toBe("2026-10-20T12:30:00.000Z");
  });
});

describe("GetDashboardOverview", () => {
  it("reads today on the cafe calendar and stays money-free", async () => {
    const overview = await new GetDashboardOverview(repo()).execute(new Date("2026-10-20T23:00:00Z"));
    expect(overview).toEqual({
      today: "2026-10-21",
      todayReservations: { bookings: 2, covers: 6, awaitingConfirmation: 1 },
      upcomingEvents: 1,
    });
  });

  it("counts events from now, so one already under way is still in the week", async () => {
    const publishedEventsDuring = vi.fn(async () => 2);
    await new GetDashboardOverview(repo({ publishedEventsDuring })).execute(NOW);

    // From this moment — not from the start of each event — to the start of the eighth day.
    expect(publishedEventsDuring).toHaveBeenCalledWith(NOW, new Date("2026-10-27T20:30:00Z"));
  });
});
