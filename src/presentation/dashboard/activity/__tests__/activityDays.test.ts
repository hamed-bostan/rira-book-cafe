import { describe, expect, it } from "vitest";

import { activityDayKind, groupByCafeDay } from "../activityDays";

describe("groupByCafeDay", () => {
  it("puts consecutive entries of one cafe day under one header, keeping their order", () => {
    const entries = [
      { id: "a", at: "2026-10-22T10:00:00Z" },
      { id: "b", at: "2026-10-22T06:00:00Z" },
      { id: "c", at: "2026-10-21T18:00:00Z" },
    ];

    expect(groupByCafeDay(entries)).toEqual([
      { day: "2026-10-22", entries: [entries[0], entries[1]] },
      { day: "2026-10-21", entries: [entries[2]] },
    ]);
  });

  it("files a late-evening entry under the cafe's day, not the UTC one", () => {
    // 21:00 UTC on the 21st is 00:30 on the 22nd in Tehran.
    expect(groupByCafeDay([{ at: "2026-10-21T21:00:00Z" }])[0]?.day).toBe("2026-10-22");
  });

  it("returns no groups for an empty log", () => {
    expect(groupByCafeDay([])).toEqual([]);
  });
});

describe("activityDayKind", () => {
  const today = "2026-10-22";

  it("names today and yesterday", () => {
    expect(activityDayKind("2026-10-22", today)).toBe("today");
    expect(activityDayKind("2026-10-21", today)).toBe("yesterday");
  });

  it("drops the year for recent days and keeps it for older ones", () => {
    expect(activityDayKind("2026-10-20", today)).toBe("recent");
    expect(activityDayKind("2026-04-25", today)).toBe("recent");
    expect(activityDayKind("2025-10-20", today)).toBe("older");
  });
});
