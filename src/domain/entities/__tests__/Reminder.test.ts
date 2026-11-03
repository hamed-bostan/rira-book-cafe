import { describe, expect, it } from "vitest";

import { wallTimeToDate } from "../CafeTime";
import { REMINDER_LATE_LIMIT_MINUTES, eveningBefore, isReminderDue, soonBefore } from "../Reminder";

const MINUTE = 60 * 1000;

describe("eveningBefore", () => {
  it("is 18:00 on the cafe's clock the day before", () => {
    expect(eveningBefore("2026-11-05")).toEqual(wallTimeToDate("2026-11-04T18:00"));
    // Tehran is UTC+03:30.
    expect(eveningBefore("2026-11-05").toISOString()).toBe("2026-11-04T14:30:00.000Z");
  });

  it("goes back across a month and a year", () => {
    expect(eveningBefore("2026-12-01")).toEqual(wallTimeToDate("2026-11-30T18:00"));
    expect(eveningBefore("2027-01-01")).toEqual(wallTimeToDate("2026-12-31T18:00"));
  });
});

describe("soonBefore", () => {
  it("is two hours before", () => {
    expect(soonBefore(wallTimeToDate("2026-11-05T19:30"))).toEqual(wallTimeToDate("2026-11-05T17:30"));
  });
});

describe("isReminderDue", () => {
  const moment = wallTimeToDate("2026-11-04T18:00");
  const madeLongBefore = wallTimeToDate("2026-10-30T10:00");
  const at = (offsetMs: number): Date => new Date(moment.getTime() + offsetMs);

  it("waits for its moment", () => {
    expect(isReminderDue(moment, madeLongBefore, at(-1))).toBe(false);
    expect(isReminderDue(moment, madeLongBefore, moment)).toBe(true);
  });

  it("is still sent a little late, but not after the late limit", () => {
    const limit = REMINDER_LATE_LIMIT_MINUTES * MINUTE;
    expect(isReminderDue(moment, madeLongBefore, at(limit - 1))).toBe(true);
    expect(isReminderDue(moment, madeLongBefore, at(limit))).toBe(false);
    expect(isReminderDue(moment, madeLongBefore, at(24 * 60 * MINUTE))).toBe(false);
  });

  it("is skipped when the booking was made after its moment", () => {
    expect(isReminderDue(moment, moment, at(5 * MINUTE))).toBe(true);
    expect(isReminderDue(moment, at(1), at(5 * MINUTE))).toBe(false);
  });
});
