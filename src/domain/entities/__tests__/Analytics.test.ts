import { describe, expect, it } from "vitest";

import {
  dayRange,
  daysOf,
  endsBeforeDayEnd,
  fillDailySeries,
  fillHourlySeries,
  netPaymentParts,
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
    const sales = { day: "2026-10-20", revenue: 500000, orders: 3, unpaidOrders: 1, unpaidValue: 120000 };
    expect(fillDailySeries(range, [sales])).toEqual([
      { day: "2026-10-19", revenue: 0, orders: 0, unpaidOrders: 0, unpaidValue: 0 },
      sales,
      { day: "2026-10-21", revenue: 0, orders: 0, unpaidOrders: 0, unpaidValue: 0 },
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

describe("netPaymentParts", () => {
  const sum = (parts: readonly { amount: number }[]): number => parts.reduce((total, part) => total + part.amount, 0);
  const CARD_AND_CASH = [
    { method: "card" as const, amount: 150000 },
    { method: "cash" as const, amount: 40000 },
  ];

  it("takes a refund off the part paid the same way", () => {
    expect(netPaymentParts(CARD_AND_CASH, [{ method: "cash", amount: 30000 }])).toEqual([
      { method: "card", amount: 150000 },
      { method: "cash", amount: 10000 },
    ]);
  });

  it("spreads what a matching part can't cover over the rest, never below nothing", () => {
    // 50,000 back in cash: 40,000 empties the cash part, 10,000 comes off the card.
    expect(netPaymentParts(CARD_AND_CASH, [{ method: "cash", amount: 50000 }])).toEqual([
      { method: "card", amount: 140000 },
      { method: "cash", amount: 0 },
    ]);
    // Back by transfer, which nobody paid with: shared by the parts' sizes, to the Toman.
    const spread = netPaymentParts(CARD_AND_CASH, [{ method: "transfer", amount: 19001 }]);
    expect(spread.every((part) => part.amount >= 0)).toBe(true);
    expect(sum(spread)).toBe(190000 - 19001);
    expect(spread.map((part) => part.method)).toEqual(["card", "cash"]);
  });

  it("leaves the parts alone when nothing was refunded, without changing them", () => {
    expect(netPaymentParts(CARD_AND_CASH, [])).toEqual(CARD_AND_CASH);
    netPaymentParts(CARD_AND_CASH, [{ method: "card", amount: 1000 }]);
    expect(CARD_AND_CASH[0].amount).toBe(150000);
  });
});
