import { describe, expect, it } from "vitest";

import { cafeDayOf, cafeDayRange, dateToWallTime, isCafeDay, isWallTime, shiftCafeDay, wallTimeToDate } from "../CafeTime";

describe("CafeTime", () => {
  it("reads wall time on Tehran's fixed +03:30 clock", () => {
    expect(wallTimeToDate("2026-10-20T19:30").toISOString()).toBe("2026-10-20T16:00:00.000Z");
    expect(dateToWallTime(new Date("2026-10-20T16:00:00Z"))).toBe("2026-10-20T19:30");
  });

  it("puts late-evening UTC instants on the next cafe day", () => {
    expect(cafeDayOf(new Date("2026-10-20T21:00:00Z"))).toBe("2026-10-21");
  });

  it("covers exactly one cafe day", () => {
    const { from, to } = cafeDayRange("2026-10-21");
    expect(from.toISOString()).toBe("2026-10-20T20:30:00.000Z");
    expect(to.getTime() - from.getTime()).toBe(24 * 60 * 60 * 1000);
  });

  it("shifts across month ends", () => {
    expect(shiftCafeDay("2026-10-31", 1)).toBe("2026-11-01");
    expect(shiftCafeDay("2026-11-01", -1)).toBe("2026-10-31");
  });

  it("validates its formats", () => {
    expect(isCafeDay("2026-10-21")).toBe(true);
    expect(isCafeDay("2026-13-01")).toBe(false);
    expect(isWallTime("2026-10-21T08:15")).toBe(true);
    expect(isWallTime("2026-10-21 08:15")).toBe(false);
  });
});
