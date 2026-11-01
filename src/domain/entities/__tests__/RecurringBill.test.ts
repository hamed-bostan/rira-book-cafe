import { describe, expect, it } from "vitest";

import { dueMonths, isBillPeriod, isDuePeriod, type RecurringBill } from "../RecurringBill";

/** Set up on 1 Aban 1405. */
const BILL: RecurringBill = {
  id: "b1",
  description: "Rent",
  accountCode: "6100",
  amount: 30_000_000,
  vatAmount: 0,
  dayOfMonth: 1,
  startsOn: "2026-10-23",
  isActive: true,
  createdAt: "",
};

const periods = (bill: RecurringBill, today: string, done: string[] = []): string[] =>
  dueMonths(bill, new Set(done), today).map((due) => due.period);

describe("isBillPeriod", () => {
  it("takes a Persian month and nothing else", () => {
    expect(isBillPeriod("1405-08")).toBe(true);
    expect(isBillPeriod("1405-12")).toBe(true);
    expect(isBillPeriod("1405-13")).toBe(false);
    expect(isBillPeriod("1405-00")).toBe(false);
    expect(isBillPeriod("1405-8")).toBe(false);
    expect(isBillPeriod("2026-10-23")).toBe(false);
  });
});

describe("dueMonths", () => {
  it("asks for a month from its due day on, and not before", () => {
    // 10 Azar is 1 December, so the day before only Aban's has come round.
    expect(periods({ ...BILL, dayOfMonth: 10 }, "2026-11-30")).toEqual(["1405-08"]);
    expect(periods({ ...BILL, dayOfMonth: 10 }, "2026-12-01")).toEqual(["1405-08", "1405-09"]);
  });

  it("gives the date it fell due", () => {
    expect(dueMonths(BILL, new Set(), "2026-10-23")).toEqual([{ bill: BILL, period: "1405-08", dueOn: "2026-10-23" }]);
  });

  it("keeps asking for a month nobody dealt with, oldest first", () => {
    expect(periods(BILL, "2027-01-22")).toEqual(["1405-08", "1405-09", "1405-10", "1405-11"]);
  });

  it("drops the months already recorded or skipped", () => {
    expect(periods(BILL, "2027-01-22", ["1405-08", "1405-10"])).toEqual(["1405-09", "1405-11"]);
  });

  it("asks nothing of the months before the bill was set up", () => {
    // Set up on the 20th with the 1st as its day: that month's 1st had already gone.
    expect(periods({ ...BILL, startsOn: "2026-11-10" }, "2026-11-20")).toEqual([]);
    expect(periods({ ...BILL, startsOn: "2026-11-10" }, "2026-11-22")).toEqual(["1405-09"]);
  });

  it("falls on the last day of a month too short for it", () => {
    // Mehr has 30 days, Aban 30, Esfand 29 in a common year.
    const due = dueMonths({ ...BILL, dayOfMonth: 31, startsOn: "2027-02-20" }, new Set(), "2027-03-20");
    expect(due).toEqual([
      { bill: { ...BILL, dayOfMonth: 31, startsOn: "2027-02-20" }, period: "1405-12", dueOn: "2027-03-20" },
    ]);
  });

  it("crosses the end of the Persian year", () => {
    expect(periods(BILL, "2027-04-21")).toContain("1405-12");
    expect(periods(BILL, "2027-04-21")).toContain("1406-02");
  });

  it("asks nothing of a bill that's switched off", () => {
    expect(periods({ ...BILL, isActive: false }, "2027-01-22")).toEqual([]);
  });
});

describe("isDuePeriod", () => {
  it("refuses a month that hasn't come round, or came before the bill", () => {
    expect(isDuePeriod(BILL, "1405-08", "2026-10-23")).toBe(true);
    expect(isDuePeriod(BILL, "1405-09", "2026-10-23")).toBe(false);
    expect(isDuePeriod(BILL, "1405-07", "2026-10-23")).toBe(false);
  });

  it("refuses something that isn't a month, and a bill that's switched off", () => {
    expect(isDuePeriod(BILL, "soon", "2026-10-23")).toBe(false);
    expect(isDuePeriod({ ...BILL, isActive: false }, "1405-08", "2026-10-23")).toBe(false);
  });
});
