import { describe, expect, it } from "vitest";

import { openingHoursLines } from "../openingHours";

describe("openingHoursLines", () => {
  it("prints a run of days as a range", () => {
    const [line] = openingHoursLines(
      [{ days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], opens: "07:00", closes: "19:00" }],
      "en",
    );
    expect(line).toEqual({ days: "Mon – Fri", hours: "7:00 AM – 7:00 PM" });
  });

  it("wraps a run across the end of the week", () => {
    const [line] = openingHoursLines(
      [{ days: ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday"], opens: "08:00", closes: "23:00" }],
      "en",
    );
    expect(line.days).toBe("Sat – Wed");
  });

  it("lists days that don't follow one another", () => {
    const [line] = openingHoursLines([{ days: ["Monday", "Thursday"], opens: "08:00", closes: "18:00" }], "en");
    expect(line.days).toBe("Mon, Thu");
  });

  it("uses Persian names and digits under fa", () => {
    const [line] = openingHoursLines([{ days: ["Friday"], opens: "08:00", closes: "18:00" }], "fa");
    expect(line.days).toBe("جمعه");
    expect(line.hours).toMatch(/۸/);
  });

  it("drops rules with no days", () => {
    expect(openingHoursLines([{ days: [], opens: "08:00", closes: "18:00" }], "en")).toEqual([]);
  });
});
