import { describe, expect, it } from "vitest";

import {
  dayRange,
  daysOf,
  fillDailySeries,
  fillHourlySeries,
  percentChange,
  presetRange,
  previousPeriod,
  rangeDays,
} from "../Analytics";

// 23:00 UTC on Oct 20 is 02:30 on Oct 21 in Tehran.
const NOW = new Date("2026-10-20T23:00:00Z");

describe("ranges", () => {
  it("ends presets on today's cafe day, inclusive", () => {
    expect(presetRange("today", NOW)).toMatchObject({ fromDay: "2026-10-21", toDay: "2026-10-21" });
    const week = presetRange("7d", NOW);
    expect(week).toMatchObject({ fromDay: "2026-10-15", toDay: "2026-10-21" });
    expect(rangeDays(week)).toBe(7);
  });

  it("compares with the same number of days right before", () => {
    expect(previousPeriod(dayRange("2026-10-15", "2026-10-21"))).toMatchObject({
      fromDay: "2026-10-08",
      toDay: "2026-10-14",
    });
  });

  it("covers whole cafe days in UTC", () => {
    const range = dayRange("2026-10-21", "2026-10-21");
    expect(range.from.toISOString()).toBe("2026-10-20T20:30:00.000Z");
    expect(range.to.toISOString()).toBe("2026-10-21T20:30:00.000Z");
  });
});

describe("series", () => {
  it("fills days without sales with zeros", () => {
    const range = dayRange("2026-10-19", "2026-10-21");
    expect(daysOf(range)).toEqual(["2026-10-19", "2026-10-20", "2026-10-21"]);
    expect(fillDailySeries(range, [{ day: "2026-10-20", revenue: 500000, orders: 3 }])).toEqual([
      { day: "2026-10-19", revenue: 0, orders: 0 },
      { day: "2026-10-20", revenue: 500000, orders: 3 },
      { day: "2026-10-21", revenue: 0, orders: 0 },
    ]);
  });

  it("fills all 24 hours", () => {
    const hours = fillHourlySeries([{ hour: 9, orders: 4 }]);
    expect(hours).toHaveLength(24);
    expect(hours[9]).toEqual({ hour: 9, orders: 4 });
    expect(hours[10].orders).toBe(0);
  });
});

describe("percentChange", () => {
  it("has no baseline from zero", () => {
    expect(percentChange(10, 0)).toBeNull();
    expect(percentChange(0, 0)).toBe(0);
    expect(percentChange(150, 100)).toBeCloseTo(0.5);
  });
});
