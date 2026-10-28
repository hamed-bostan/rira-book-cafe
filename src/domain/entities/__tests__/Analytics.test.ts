import { describe, expect, it } from "vitest";

import {
  dayRange,
  daysOf,
  endsBeforeDayEnd,
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
    const previous = previousPeriod(dayRange("2026-10-15", "2026-10-21"), NOW);
    expect(previous).toMatchObject({ fromDay: "2026-10-08", toDay: "2026-10-14" });
    expect(previous.to).toEqual(dayRange("2026-10-14", "2026-10-14").to);
    expect(endsBeforeDayEnd(previous)).toBe(false);
  });

  it("compares today with yesterday at this time on the cafe clock", () => {
    // 12:30 UTC is 16:00 in Tehran.
    const now = new Date("2026-10-21T12:30:00Z");
    const previous = previousPeriod(presetRange("today", now), now);
    expect(previous).toMatchObject({ fromDay: "2026-10-20", toDay: "2026-10-20" });
    expect(previous.from.toISOString()).toBe("2026-10-19T20:30:00.000Z");
    expect(previous.to.toISOString()).toBe("2026-10-20T12:30:00.000Z");
    expect(endsBeforeDayEnd(previous)).toBe(true);
  });

  it("compares a single day that's over with the whole day before", () => {
    const now = new Date("2026-10-21T12:30:00Z");
    const previous = previousPeriod(dayRange("2026-10-19", "2026-10-19"), now);
    expect(previous).toMatchObject({ fromDay: "2026-10-18", toDay: "2026-10-18" });
    expect(endsBeforeDayEnd(previous)).toBe(false);
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
    const hours = fillHourlySeries([{ hour: 9, orders: 4, revenue: 480000 }]);
    expect(hours).toHaveLength(24);
    expect(hours[9]).toEqual({ hour: 9, orders: 4, revenue: 480000 });
    expect(hours[10]).toEqual({ hour: 10, orders: 0, revenue: 0 });
  });
});

describe("percentChange", () => {
  it("has no baseline from zero", () => {
    expect(percentChange(10, 0)).toBeNull();
    expect(percentChange(0, 0)).toBe(0);
    expect(percentChange(150, 100)).toBeCloseTo(0.5);
  });
});
