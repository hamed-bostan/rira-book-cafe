import { describe, expect, it } from "vitest";

import { fiscalYearDays, jalaliMonthDays, jalaliToday } from "@/src/domain/entities/JalaliCalendar";
import { parseResultsPeriod, resultsPeriodSpan } from "@/src/lib/api/accounting-period-params";

describe("parseResultsPeriod", () => {
  it("reads a known period", () => {
    expect(parseResultsPeriod(new URLSearchParams("period=last"))).toBe("last");
    expect(parseResultsPeriod(new URLSearchParams("period=year"))).toBe("year");
  });

  it("falls back to this month when absent or unknown", () => {
    expect(parseResultsPeriod(new URLSearchParams())).toBe("month");
    expect(parseResultsPeriod(new URLSearchParams("period=week"))).toBe("month");
  });
});

describe("resultsPeriodSpan", () => {
  // Mid-Aban 1405.
  const autumn = new Date("2026-10-27T09:00:00Z");

  it("covers this Persian month", () => {
    const today = jalaliToday(autumn);
    expect(resultsPeriodSpan("month", autumn)).toEqual(jalaliMonthDays(today.jy, today.jm));
  });

  it("covers the month before, ending the day before this one starts", () => {
    const today = jalaliToday(autumn);
    const last = resultsPeriodSpan("last", autumn);
    expect(last).toEqual(jalaliMonthDays(today.jy, today.jm - 1));
    const dayAfter = new Date(`${last.toDay}T12:00:00Z`);
    dayAfter.setUTCDate(dayAfter.getUTCDate() + 1);
    expect(dayAfter.toISOString().slice(0, 10)).toBe(resultsPeriodSpan("month", autumn).fromDay);
  });

  it("reaches back into last year's Esfand from Farvardin", () => {
    const farvardin = new Date("2027-04-01T09:00:00Z");
    const today = jalaliToday(farvardin);
    expect(today.jm).toBe(1);
    expect(resultsPeriodSpan("last", farvardin)).toEqual(jalaliMonthDays(today.jy - 1, 12));
  });

  it("covers the whole fiscal year", () => {
    expect(resultsPeriodSpan("year", autumn)).toEqual(fiscalYearDays(jalaliToday(autumn).jy));
  });
});
