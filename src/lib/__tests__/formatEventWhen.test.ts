import { describe, expect, it } from "vitest";

import { formatEventTime, formatEventWhen } from "../formatEventWhen";

// 18:30–20:30 on the cafe's clock (Tehran, UTC+03:30).
const STARTS = "2026-10-29T15:00:00.000Z";
const ENDS = "2026-10-29T17:00:00.000Z";

describe("formatEventWhen", () => {
  it("reads the day and an unpadded time range on the cafe clock", () => {
    expect(formatEventWhen(STARTS, ENDS, "en")).toBe("Thursday, October 29 · 6:30 PM – 8:30 PM");
  });

  it("has a short form for dialog subtitles", () => {
    expect(formatEventWhen(STARTS, ENDS, "en", "short")).toBe("Thu, Oct 29 · 6:30 PM – 8:30 PM");
  });

  it("uses a 24-hour clock with Persian digits under fa", () => {
    expect(formatEventTime(STARTS, "fa")).toBe("۱۸:۳۰");
  });
});
