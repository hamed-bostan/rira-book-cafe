import { describe, expect, it } from "vitest";

import {
  buildRevenueStreams,
  calendarForLocale,
  monthOf,
  presetRange,
  previousPeriod,
  rangeDays,
  salesBridge,
  weekStart,
} from "../Analytics";

// 08:30 UTC on Wednesday 2026-10-21 is 12:00 in Tehran — 29 Mehr 1405.
const NOW = new Date("2026-10-21T08:30:00Z");

describe("calendar presets", () => {
  it("starts the week on Saturday", () => {
    expect(weekStart("2026-10-21")).toBe("2026-10-17");
    expect(weekStart("2026-10-17")).toBe("2026-10-17");
    expect(weekStart("2026-10-23")).toBe("2026-10-17");
    expect(presetRange("week", NOW)).toMatchObject({ fromDay: "2026-10-17", toDay: "2026-10-21" });
  });

  it("runs this month from its first day on the reader's calendar", () => {
    expect(presetRange("month", NOW, "gregorian")).toMatchObject({ fromDay: "2026-10-01", toDay: "2026-10-21" });
    // 1 Mehr 1405 is 23 September 2026.
    expect(presetRange("month", NOW, "jalali")).toMatchObject({ fromDay: "2026-09-23", toDay: "2026-10-21" });
  });

  it("takes last month whole", () => {
    expect(presetRange("lastMonth", NOW, "gregorian")).toMatchObject({ fromDay: "2026-09-01", toDay: "2026-09-30" });
    // Shahrivar 1405: 31 days, 23 August – 22 September.
    const shahrivar = presetRange("lastMonth", NOW, "jalali");
    expect(shahrivar).toMatchObject({ fromDay: "2026-08-23", toDay: "2026-09-22" });
    expect(rangeDays(shahrivar)).toBe(31);
  });

  it("knows the length of a Gregorian month, leap Februaries included", () => {
    expect(monthOf("2028-02-10", "gregorian")).toEqual({ fromDay: "2028-02-01", toDay: "2028-02-29" });
    expect(monthOf("2026-12-31", "gregorian")).toEqual({ fromDay: "2026-12-01", toDay: "2026-12-31" });
  });

  it("compares a calendar range with the same number of days before it", () => {
    const lastMonth = presetRange("lastMonth", NOW, "gregorian");
    expect(previousPeriod(lastMonth, NOW)).toMatchObject({ fromDay: "2026-08-02", toDay: "2026-08-31" });
  });

  it("gives Persian readers the Jalali calendar", () => {
    expect(calendarForLocale("fa")).toBe("jalali");
    expect(calendarForLocale("en")).toBe("gregorian");
    expect(calendarForLocale(undefined)).toBe("gregorian");
  });
});

describe("salesBridge", () => {
  const totals = { grossSales: 1000, promoDiscount: 100, pointsDiscount: 50, charged: 850, refunds: 30 };

  it("lands on the revenue to the Toman, without an adjustments line when there's nothing to explain", () => {
    const lines = salesBridge(totals, { ...totals, refunds: 0 });
    expect(lines.map((line) => line.key)).not.toContain("otherAdjustments");
    const steps = lines.filter((line) => line.kind === "start" || line.kind === "step");
    expect(steps.reduce((sum, line) => sum + line.amount, 0)).toBe(820);
    expect(lines.at(-1)).toEqual({ key: "revenue", kind: "total", amount: 820, previous: 850 });
  });

  it("shows what the named lines don't explain, so nothing hides", () => {
    const lines = salesBridge({ ...totals, charged: 870 }, totals);
    expect(lines.find((line) => line.key === "otherAdjustments")).toMatchObject({ amount: 20, previous: 0 });
    expect(lines.at(-1)?.amount).toBe(840);
  });
});

describe("buildRevenueStreams", () => {
  it("fills every stream in order and nets refunds and their VAT", () => {
    const streams = buildRevenueStreams(
      [{ stream: "cafe", received: 1100, refunded: 110, vat: 100, vatRefunded: 10 }],
      [{ stream: "cafe", received: 500, refunded: 0, vat: 0, vatRefunded: 0 }],
    );
    expect(streams).toHaveLength(6);
    expect(streams[0]).toEqual({
      stream: "cafe",
      received: 1100,
      refunded: 110,
      revenue: 990,
      vat: 90,
      revenueExVat: 900,
      previousRevenue: 500,
    });
    expect(streams.slice(1).every((row) => row.revenue === 0 && row.previousRevenue === 0)).toBe(true);
  });
});
