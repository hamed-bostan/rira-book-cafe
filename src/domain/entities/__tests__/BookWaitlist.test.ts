import { describe, expect, it } from "vitest";

import { HOLD_PICKUP_DAYS, holdPickupDeadline, holdPickupState, isHoldPickupPassed } from "../BookWaitlist";
import { wallTimeToDate } from "../CafeTime";

describe("holdPickupDeadline", () => {
  it("is the end of the third cafe day after the day they were told", () => {
    expect(HOLD_PICKUP_DAYS).toBe(3);
    // Told Tuesday 3 Nov at 10:00 Tehran → collect by the end of Friday 6 Nov.
    expect(holdPickupDeadline(wallTimeToDate("2026-11-03T10:00")).toISOString()).toBe("2026-11-06T20:29:59.999Z");
  });

  it("counts days on the cafe's clock, not UTC's", () => {
    // 23:50 on 3 Nov in Tehran is still 3 Nov there…
    expect(holdPickupDeadline(new Date("2026-11-03T20:20:00Z")).toISOString()).toBe("2026-11-06T20:29:59.999Z");
    // …and 00:10 on 4 Nov in Tehran is 4 Nov, though UTC still says 3 Nov.
    expect(holdPickupDeadline(new Date("2026-11-03T20:40:00Z")).toISOString()).toBe("2026-11-07T20:29:59.999Z");
  });
});

describe("holdPickupState", () => {
  const pickupBy = holdPickupDeadline(wallTimeToDate("2026-11-03T10:00")).toISOString();

  it("is open while there are days to go", () => {
    expect(holdPickupState(pickupBy, wallTimeToDate("2026-11-03T10:00"))).toBe("open");
    expect(holdPickupState(pickupBy, wallTimeToDate("2026-11-04T23:59"))).toBe("open");
  });

  it("is closing on the day before the last day and on the last day", () => {
    expect(holdPickupState(pickupBy, wallTimeToDate("2026-11-05T00:00"))).toBe("closing");
    expect(holdPickupState(pickupBy, wallTimeToDate("2026-11-06T23:59"))).toBe("closing");
  });

  it("has passed once the last day is over", () => {
    expect(holdPickupState(pickupBy, wallTimeToDate("2026-11-07T00:00"))).toBe("passed");
  });
});

describe("isHoldPickupPassed", () => {
  const pickupBy = "2026-11-06T20:29:59.999Z";
  const told = { status: "notified" as const, pickupBy };

  it("passes the instant after the deadline, not at it", () => {
    expect(isHoldPickupPassed(told, new Date(pickupBy))).toBe(false);
    expect(isHoldPickupPassed(told, new Date("2026-11-06T20:30:00.000Z"))).toBe(true);
  });

  it("only for a guest who's still told", () => {
    const later = new Date("2026-11-10T10:00:00Z");
    expect(isHoldPickupPassed({ status: "fulfilled", pickupBy }, later)).toBe(false);
    expect(isHoldPickupPassed({ status: "waiting" }, later)).toBe(false);
  });
});
