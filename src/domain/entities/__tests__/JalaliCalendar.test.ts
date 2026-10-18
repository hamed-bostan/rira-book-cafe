import { describe, expect, it } from "vitest";

import {
  completeMonthsBefore,
  fiscalYearDays,
  fromJalali,
  isLeapJalaliYear,
  jalaliMonthDays,
  jalaliMonthLength,
  toJalali,
} from "../JalaliCalendar";

/** The platform's own Persian calendar, as an independent oracle. */
function intlJalali(day: string): { jy: number; jm: number; jd: number } {
  const parts = new Intl.DateTimeFormat("en-u-ca-persian-nu-latn", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    timeZone: "UTC",
  }).formatToParts(new Date(`${day}T12:00:00Z`));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { jy: get("year"), jm: get("month"), jd: get("day") };
}

describe("JalaliCalendar", () => {
  it("knows Nowruz", () => {
    expect(fromJalali(1403, 1, 1)).toBe("2024-03-20");
    expect(fromJalali(1404, 1, 1)).toBe("2025-03-21");
    expect(fromJalali(1405, 1, 1)).toBe("2026-03-21");
    expect(toJalali("2026-10-16")).toEqual({ jy: 1405, jm: 7, jd: 24 });
  });

  it("agrees with Intl's Persian calendar for every day of 1395–1415", () => {
    for (let day = fromJalali(1395, 1, 1); day < fromJalali(1415, 1, 1);) {
      const ours = toJalali(day);
      expect(ours).toEqual(intlJalali(day));
      expect(fromJalali(ours.jy, ours.jm, ours.jd)).toBe(day);
      const next = new Date(`${day}T12:00:00Z`);
      next.setUTCDate(next.getUTCDate() + 1);
      day = next.toISOString().slice(0, 10);
    }
    // ~7,300 days through Intl: about 3s alone, more under the full suite's parallel
    // load, so it gets more than the 5s default.
  }, 20_000);

  it("sizes months and leap Esfands", () => {
    expect(jalaliMonthLength(1405, 1)).toBe(31);
    expect(jalaliMonthLength(1405, 7)).toBe(30);
    expect(isLeapJalaliYear(1403)).toBe(true);
    expect(jalaliMonthLength(1403, 12)).toBe(30);
    expect(jalaliMonthLength(1404, 12)).toBe(29);
  });

  it("spans months and fiscal years", () => {
    expect(jalaliMonthDays(1405, 7)).toEqual({ fromDay: "2026-09-23", toDay: "2026-10-22" });
    expect(fiscalYearDays(1405)).toEqual({ fromDay: "2026-03-21", toDay: "2027-03-20" });
  });
});

describe("completeMonthsBefore", () => {
  it("takes whole months before the current one, across the new year", () => {
    // In Mehr 1405, the last three complete months are Tir–Shahrivar.
    expect(completeMonthsBefore({ jy: 1405, jm: 7, jd: 24 }, 3)).toEqual({
      fromDay: jalaliMonthDays(1405, 4).fromDay,
      toDay: jalaliMonthDays(1405, 6).toDay,
    });
    // In Ordibehesht 1405, two months back reaches Esfand 1404.
    expect(completeMonthsBefore({ jy: 1405, jm: 2, jd: 1 }, 2)).toEqual({
      fromDay: jalaliMonthDays(1404, 12).fromDay,
      toDay: jalaliMonthDays(1405, 1).toDay,
    });
  });
});
