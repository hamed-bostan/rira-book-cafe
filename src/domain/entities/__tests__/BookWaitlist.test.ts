import { describe, expect, it } from "vitest";

import {
  HOLD_PICKUP_DAYS,
  MAX_OPEN_HOLDS_PER_GUEST,
  bookHasLine,
  canBorrowBook,
  canHoldAnother,
  holdPickupDeadline,
  holdPickupState,
  isHoldPickupPassed,
} from "../BookWaitlist";
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

describe("canHoldAnother", () => {
  it("lets a guest hold up to three books at once, ready or waiting alike", () => {
    expect(MAX_OPEN_HOLDS_PER_GUEST).toBe(3);
    expect(canHoldAnother(0)).toBe(true);
    expect(canHoldAnother(2)).toBe(true);
    expect(canHoldAnother(3)).toBe(false);
  });
});

describe("bookHasLine and canBorrowBook", () => {
  const told = { status: "notified" as const };
  const waiting = { status: "waiting" as const };

  it("offers a copy nobody holds or waits for to borrow, with no line", () => {
    expect(canBorrowBook(1, [])).toBe(true);
    expect(bookHasLine(1, [])).toBe(false);
    // Two free, one held for a told guest: the other is still free to borrow.
    expect(canBorrowBook(2, [told])).toBe(true);
  });

  it("has a line once every copy is out or held", () => {
    expect(canBorrowBook(0, [])).toBe(false);
    expect(bookHasLine(0, [])).toBe(true);
    // The one free copy is held for the guest who was told — or who borrowed it.
    expect(canBorrowBook(1, [told])).toBe(false);
    expect(bookHasLine(1, [told])).toBe(true);
    // More told than free (copies written off since): still a line.
    expect(canBorrowBook(1, [told, told])).toBe(false);
  });

  it("keeps a free copy for guests already waiting: they come first", () => {
    expect(canBorrowBook(1, [waiting])).toBe(false);
    expect(bookHasLine(2, [told, waiting])).toBe(true);
  });
});
