import { describe, expect, it } from "vitest";

import { daysOf, dayRange, fillHourlySeries } from "@/src/domain/entities/Analytics";

import { formatDayTip } from "../reportFormat";
import { buildSalesChart, chartTickStep } from "../salesChart";

const TODAY = "2026-10-22";

/** A day series ending today, one order and 100,000 Toman a day. */
function days(count: number) {
  const fromDay = new Date(Date.UTC(2026, 9, 22 - (count - 1))).toISOString().slice(0, 10);
  return daysOf(dayRange(fromDay, TODAY)).map((day) => ({ day, revenue: 100000, orders: 1 }));
}

describe("buildSalesChart", () => {
  it("draws one day by the hour, over the cafe's usual day, with the current hour soft", () => {
    const hourly = fillHourlySeries([{ hour: 9, orders: 2, revenue: 300000 }]);
    const chart = buildSalesChart([{ day: TODAY, revenue: 300000, orders: 2 }], hourly, { day: TODAY, hour: 15 });

    expect(chart.kind).toBe("hourly");
    expect(chart.points.map((point) => point.hour)).toEqual(Array.from({ length: 15 }, (_, index) => 8 + index));
    expect(chart.points.find((point) => point.hour === 9)).toMatchObject({ orders: 2, revenue: 300000 });
    expect(chart.points.filter((point) => point.soft).map((point) => point.hour)).toEqual([15]);
    expect(chart.points.filter((point) => point.labelled).map((point) => point.hour)).toEqual([
      8, 10, 12, 14, 16, 18, 20, 22,
    ]);
  });

  it("stretches the hours to a late order and draws a past day with nothing soft", () => {
    const hourly = fillHourlySeries([{ hour: 23, orders: 1, revenue: 90000 }]);
    const chart = buildSalesChart([{ day: "2026-10-20", revenue: 90000, orders: 1 }], hourly, {
      day: TODAY,
      hour: 15,
    });

    expect(chart.points.at(-1)?.hour).toBe(23);
    expect(chart.points.some((point) => point.soft)).toBe(false);
  });

  it("labels every day of a week, and today is the soft bar", () => {
    const chart = buildSalesChart(days(7), [], { day: TODAY, hour: 12 });

    expect(chart.kind).toBe("daily");
    expect(chart.points.every((point) => point.labelled)).toBe(true);
    expect(chart.points.map((point) => point.soft)).toEqual([false, false, false, false, false, false, true]);
  });

  it("labels a day a week on a month, counted back from today", () => {
    const chart = buildSalesChart(days(30), [], { day: TODAY, hour: 12 });

    expect(chart.kind).toBe("daily");
    expect(chart.points.filter((point) => point.labelled).map((point) => point.day)).toEqual([
      "2026-09-24",
      "2026-10-01",
      "2026-10-08",
      "2026-10-15",
      "2026-10-22",
    ]);
  });

  it("goes by the week past a month, the last week ending today and only the first one short", () => {
    const chart = buildSalesChart(days(90), [], { day: TODAY, hour: 12 });

    expect(chart.kind).toBe("weekly");
    expect(chart.points).toHaveLength(13);
    expect(chart.points[0]).toMatchObject({ day: "2026-07-25", orders: 6, revenue: 600000 });
    expect(chart.points.at(-1)).toMatchObject({ day: "2026-10-16", orders: 7, soft: true });
    expect(chart.points.filter((point) => point.soft)).toHaveLength(1);
    expect(chart.points.at(-1)?.labelled).toBe(true);
    expect(chart.points.at(-2)?.labelled).toBe(false);
  });
});

describe("chartTickStep", () => {
  it("snaps the step to 1, 2 or 5 × 10ⁿ so the top tick clears the tallest bar", () => {
    expect(chartTickStep(11_200_000)).toBe(5_000_000);
    expect(chartTickStep(5_400_000)).toBe(2_000_000);
    expect(chartTickStep(2_900_000)).toBe(1_000_000);
    expect(chartTickStep(140)).toBe(50);
    expect(chartTickStep(30)).toBe(10);
  });

  it("never steps by less than one, so a quiet day doesn't count half orders", () => {
    expect(chartTickStep(0)).toBe(1);
    expect(chartTickStep(2)).toBe(1);
    expect(chartTickStep(4)).toBe(2);
  });
});

describe("formatDayTip", () => {
  it("heads a day's tooltip with the short weekday and date", () => {
    expect(formatDayTip("2026-10-22", "en")).toBe("Thu, Oct 22");
  });
});
