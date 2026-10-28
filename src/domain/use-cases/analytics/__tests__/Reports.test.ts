import { describe, expect, it, vi } from "vitest";

import { dayRange, presetRange, type DateRange, type SalesSummary } from "../../../entities/Analytics";
import { GetDashboardOverview, GetGuestReport, GetPaymentReport, GetSalesReport, TOP_ITEMS_LIMIT } from "../Reports";

import type { IAnalyticsRepository } from "../../../repositories/IAnalyticsRepository";

const EMPTY: SalesSummary = {
  revenue: 0,
  orders: 0,
  itemsSold: 0,
  averageOrderValue: 0,
  cancelledOrders: 0,
  cancelledValue: 0,
};

/** 12:30 UTC on Oct 21 is 16:00 on Oct 21 in Tehran. */
const NOW = new Date("2026-10-21T12:30:00Z");

function repo(overrides: Partial<IAnalyticsRepository> = {}): IAnalyticsRepository {
  return {
    salesSummary: vi.fn(async () => EMPTY),
    dailySales: vi.fn(async () => []),
    hourlySales: vi.fn(async () => []),
    salesByKind: vi.fn(async () => []),
    topItems: vi.fn(async () => []),
    paymentSummary: vi.fn(),
    paidByMethod: vi.fn(),
    unpaidOrders: vi.fn(),
    guestCounts: vi.fn(),
    topGuests: vi.fn(),
    reservationStats: vi.fn(),
    activeOrderCount: vi.fn(async () => 3),
    reservationsOn: vi.fn(async () => ({ bookings: 2, covers: 6, awaitingConfirmation: 1 })),
    publishedEventsBetween: vi.fn(async () => 1),
    ...overrides,
  };
}

describe("GetSalesReport", () => {
  it("compares with the previous period and fills the series", async () => {
    const salesSummary = vi.fn(async () => EMPTY);
    const report = await new GetSalesReport(repo({ salesSummary })).execute(
      dayRange("2026-10-15", "2026-10-21"),
      "revenue",
      NOW,
    );

    expect(report.previousRange).toMatchObject({ fromDay: "2026-10-08", toDay: "2026-10-14" });
    expect(salesSummary).toHaveBeenCalledTimes(2);
    expect(report.daily).toHaveLength(7);
    expect(report.hourly).toHaveLength(24);
  });

  it("compares today with yesterday up to the same time", async () => {
    const salesSummary = vi.fn(async (_range: DateRange) => EMPTY);
    const report = await new GetSalesReport(repo({ salesSummary })).execute(presetRange("today", NOW), "revenue", NOW);

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
    const range = dayRange("2026-10-15", "2026-10-21");
    const report = await new GetSalesReport(repo({ topItems })).execute(range, "quantity", NOW, "fa");

    expect(topItems).toHaveBeenCalledWith(range, "quantity", TOP_ITEMS_LIMIT, "fa");
    expect(report.topItems).toEqual([item]);
  });
});

describe("GetPaymentReport", () => {
  it("says how the paid orders came in beside the unpaid ones", async () => {
    const byMethod = [{ method: "cash" as const, orders: 3, value: 450000 }];
    const summary = { revenue: 450000, paidOrders: 3, paidValue: 450000, unpaidOrders: 1, unpaidValue: 120000 };
    const report = await new GetPaymentReport(
      repo({
        paymentSummary: vi.fn(async () => summary),
        paidByMethod: vi.fn(async () => byMethod),
        unpaidOrders: vi.fn(async () => []),
      }),
    ).execute(dayRange("2026-10-15", "2026-10-21"), NOW);

    expect(report.summary).toEqual(summary);
    expect(report.byMethod).toEqual(byMethod);
    expect(report.unpaid).toEqual([]);
    expect(report.previousRange).toMatchObject({ fromDay: "2026-10-08", toDay: "2026-10-14" });
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
    ).execute(dayRange("2026-10-15", "2026-10-21"), NOW);

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
      activeOrders: 3,
      todayReservations: { bookings: 2, covers: 6, awaitingConfirmation: 1 },
      upcomingEvents: 1,
    });
  });
});
