import { describe, expect, it, vi } from "vitest";

import { dayRange, type SalesSummary } from "../../../entities/Analytics";
import { GetDashboardOverview, GetSalesReport } from "../Reports";

import type { IAnalyticsRepository } from "../../../repositories/IAnalyticsRepository";

const EMPTY: SalesSummary = { revenue: 0, orders: 0, itemsSold: 0, averageOrderValue: 0, cancelledOrders: 0, cancelledValue: 0 };

function repo(overrides: Partial<IAnalyticsRepository> = {}): IAnalyticsRepository {
  return {
    salesSummary: vi.fn(async () => EMPTY),
    dailySales: vi.fn(async () => []),
    hourlyOrders: vi.fn(async () => []),
    salesByKind: vi.fn(async () => []),
    salesByService: vi.fn(async () => []),
    topItems: vi.fn(async () => []),
    paymentSummary: vi.fn(),
    unpaidOrders: vi.fn(),
    guestCounts: vi.fn(),
    topGuests: vi.fn(),
    reservationStats: vi.fn(),
    eventStats: vi.fn(),
    activeOrderCount: vi.fn(async () => 3),
    reservationsOn: vi.fn(async () => ({ bookings: 2, covers: 6, awaitingConfirmation: 1 })),
    publishedEventsBetween: vi.fn(async () => 1),
    ...overrides,
  };
}

describe("GetSalesReport", () => {
  it("compares with the previous period and fills both series", async () => {
    const salesSummary = vi.fn(async () => EMPTY);
    const report = await new GetSalesReport(repo({ salesSummary })).execute(dayRange("2026-10-15", "2026-10-21"), "revenue");

    expect(report.previousRange).toMatchObject({ fromDay: "2026-10-08", toDay: "2026-10-14" });
    expect(salesSummary).toHaveBeenCalledTimes(2);
    expect(report.daily).toHaveLength(7);
    expect(report.previousDaily).toHaveLength(7);
    expect(report.hourly).toHaveLength(24);
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
