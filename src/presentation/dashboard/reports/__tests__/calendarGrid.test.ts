import { describe, expect, it } from "vitest";

import {
  calendarMonthOf,
  dayOfMonth,
  monthBounds,
  monthWeeks,
  pickDay,
  shiftMonth,
  weekdayColumns,
} from "../calendarGrid";

describe("the range picker's month grid", () => {
  it("lays a Gregorian month out in Saturday-first weeks", () => {
    const weeks = monthWeeks({ year: 2026, month: 10 }, "gregorian");
    // 1 October 2026 is a Thursday: five blanks (Sat–Wed) before it.
    expect(weeks[0]).toEqual([null, null, null, null, null, "2026-10-01", "2026-10-02"]);
    expect(weeks.flat().filter(Boolean)).toHaveLength(31);
    expect(weeks.every((week) => week.length === 7)).toBe(true);
  });

  it("lays a Jalali month out on Gregorian cafe days", () => {
    const mehr = { year: 1405, month: 7 };
    expect(monthBounds(mehr, "jalali")).toEqual({ first: "2026-09-23", last: "2026-10-22" });
    const days = monthWeeks(mehr, "jalali").flat().filter(Boolean);
    expect(days).toHaveLength(30);
    expect(dayOfMonth("2026-10-21", "jalali")).toBe(29);
    expect(calendarMonthOf("2026-10-21", "jalali")).toEqual(mehr);
  });

  it("turns months across a year's end", () => {
    expect(shiftMonth({ year: 1405, month: 12 }, 1)).toEqual({ year: 1406, month: 1 });
    expect(shiftMonth({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 });
  });

  it("names the week's columns from Saturday", () => {
    const columns = weekdayColumns();
    expect(columns).toHaveLength(7);
    expect(new Date(`${columns[0]}T00:00:00Z`).getUTCDay()).toBe(6);
  });

  it("starts a span on the first click and ends it on the second, in either order", () => {
    const started = pickDay({ from: null, to: null }, "2026-10-10");
    expect(started).toEqual({ from: "2026-10-10", to: null });
    expect(pickDay(started, "2026-10-04")).toEqual({ from: "2026-10-04", to: "2026-10-10" });
    expect(pickDay({ from: "2026-10-04", to: "2026-10-10" }, "2026-10-12")).toEqual({
      from: "2026-10-12",
      to: null,
    });
  });
});
