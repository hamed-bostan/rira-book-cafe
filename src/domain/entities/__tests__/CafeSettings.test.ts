import { describe, expect, it } from "vitest";

import {
  WEEKDAYS,
  closedWeekdays,
  dayHoursValue,
  hoursOn,
  inLanguage,
  instagramHandle,
  isClockTime,
  isOpenAt,
  nextOpening,
  openingRules,
  upcomingExceptions,
  weekdayOf,
  type OpeningHours,
  type WeeklyHours,
} from "../CafeSettings";
import { wallTimeToDate } from "../CafeTime";

const OPEN = { closed: false, opens: "08:00", closes: "22:00" };

/** Saturday–Thursday 08:00–22:00, Friday closed. */
function week(overrides: Partial<WeeklyHours> = {}): WeeklyHours {
  return {
    ...(Object.fromEntries(WEEKDAYS.map((day) => [day, OPEN])) as WeeklyHours),
    Friday: { closed: true },
    ...overrides,
  };
}

function hours(overrides: Partial<OpeningHours> = {}): OpeningHours {
  return { weekly: week(), exceptions: [], ...overrides };
}

/** An instant on the cafe's wall clock. */
const at = (wallTime: string): Date => wallTimeToDate(wallTime);

describe("weekdays", () => {
  it("reads the week Saturday first and names the day a cafe date falls on", () => {
    expect(WEEKDAYS[0]).toBe("Saturday");
    expect(weekdayOf("2026-11-07")).toBe("Saturday");
    expect(weekdayOf("2026-11-13")).toBe("Friday");
  });

  it("knows a wall-clock time", () => {
    expect(isClockTime("08:00")).toBe(true);
    expect(isClockTime("23:59")).toBe(true);
    expect(isClockTime("24:00")).toBe(false);
    expect(isClockTime("8:00")).toBe(false);
  });
});

describe("isOpenAt", () => {
  it("says nothing either way before the hours are set", () => {
    expect(isOpenAt(hours({ weekly: null }), at("2026-11-07T12:00"))).toBeNull();
  });

  it("is open between the day's opening and closing, closing time excluded", () => {
    expect(isOpenAt(hours(), at("2026-11-07T08:00"))).toBe(true);
    expect(isOpenAt(hours(), at("2026-11-07T21:59"))).toBe(true);
    expect(isOpenAt(hours(), at("2026-11-07T22:00"))).toBe(false);
    expect(isOpenAt(hours(), at("2026-11-07T07:59"))).toBe(false);
  });

  it("is closed all day on a closed weekday", () => {
    expect(isOpenAt(hours(), at("2026-11-13T12:00"))).toBe(false);
  });

  it("stays open past midnight into the next day when the close is before the open", () => {
    const late = hours({ weekly: week({ Thursday: { closed: false, opens: "18:00", closes: "02:00" } }) });
    expect(isOpenAt(late, at("2026-11-12T23:30"))).toBe(true);
    // Friday is closed, but Thursday night runs on until two.
    expect(isOpenAt(late, at("2026-11-13T01:30"))).toBe(true);
    expect(isOpenAt(late, at("2026-11-13T02:00"))).toBe(false);
  });

  it("follows a special day over its weekday", () => {
    const holiday = hours({ exceptions: [{ date: "2026-11-07", closed: true }] });
    expect(isOpenAt(holiday, at("2026-11-07T12:00"))).toBe(false);

    const lateFriday = hours({ exceptions: [{ date: "2026-11-13", closed: false, opens: "16:00", closes: "20:00" }] });
    expect(isOpenAt(lateFriday, at("2026-11-13T17:00"))).toBe(true);
    expect(hoursOn(lateFriday, "2026-11-13")).toEqual({ closed: false, opens: "16:00", closes: "20:00" });
  });
});

describe("nextOpening", () => {
  it("finds the next opening later today, or on a following day", () => {
    expect(nextOpening(hours(), at("2026-11-07T06:00"))).toEqual({ day: "2026-11-07", opens: "08:00" });
    expect(nextOpening(hours(), at("2026-11-12T23:00"))).toEqual({ day: "2026-11-14", opens: "08:00" });
  });

  it("is null when the hours are unset or nothing opens all week", () => {
    expect(nextOpening(hours({ weekly: null }), at("2026-11-07T06:00"))).toBeNull();
    const shut = Object.fromEntries(WEEKDAYS.map((day) => [day, { closed: true }])) as WeeklyHours;
    expect(nextOpening(hours({ weekly: shut }), at("2026-11-07T06:00"))).toBeNull();
  });
});

describe("openingRules", () => {
  it("groups the open days by their hours, Saturday first, and leaves closed days out", () => {
    const rules = openingRules(week({ Thursday: { closed: false, opens: "08:00", closes: "23:00" } }));
    expect(rules).toEqual([
      { days: ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday"], opens: "08:00", closes: "22:00" },
      { days: ["Thursday"], opens: "08:00", closes: "23:00" },
    ]);
    expect(closedWeekdays(week())).toEqual(["Friday"]);
  });
});

describe("upcomingExceptions", () => {
  it("lists the special days from today through the coming weeks, in date order", () => {
    const special = hours({
      exceptions: [
        { date: "2027-03-21", closed: true },
        { date: "2026-11-01", closed: true },
        { date: "2026-11-20", closed: false, opens: "12:00", closes: "18:00" },
      ],
    });
    expect(upcomingExceptions(special, "2026-11-04").map((day) => day.date)).toEqual(["2026-11-20"]);
    expect(upcomingExceptions(special, "2026-11-04", 200).map((day) => day.date)).toEqual(["2026-11-20", "2027-03-21"]);
  });
});

describe("helpers", () => {
  it("reads an Instagram username from what staff paste", () => {
    expect(instagramHandle("rira.cafe")).toBe("rira.cafe");
    expect(instagramHandle("@rira.cafe")).toBe("rira.cafe");
    expect(instagramHandle("https://www.instagram.com/rira.cafe/?hl=en")).toBe("rira.cafe");
  });

  it("picks the reader's language, or the other one when theirs is blank", () => {
    expect(inLanguage("fa", "Rira", "ریرا")).toBe("ریرا");
    expect(inLanguage("fa", "Rira", undefined)).toBe("Rira");
    expect(inLanguage("en", undefined, "ریرا")).toBe("ریرا");
    expect(inLanguage("en", undefined, undefined)).toBeUndefined();
  });

  it("writes a day's hours as one activity value", () => {
    expect(dayHoursValue(OPEN)).toBe("08:00–22:00");
    expect(dayHoursValue({ closed: true })).toBe("closed");
    expect(dayHoursValue(undefined)).toBeNull();
  });
});
