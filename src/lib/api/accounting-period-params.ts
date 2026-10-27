import { fiscalYearDays, jalaliMonthDays, jalaliToday } from "@/src/domain/entities/JalaliCalendar";

import type { DaySpan } from "./accounting-params";

/**
 * The periods the Accounting overview's results can show, on the Persian
 * calendar: this month, the month before it, and this fiscal year (from
 * 1 Farvardin). `?period=` in the URL; anything else is this month.
 */
export const RESULTS_PERIODS = ["month", "last", "year"] as const;
export type ResultsPeriod = (typeof RESULTS_PERIODS)[number];

export function parseResultsPeriod(params: URLSearchParams): ResultsPeriod {
  const value = params.get("period");
  return RESULTS_PERIODS.find((period) => period === value) ?? "month";
}

/** The days a period covers, both inclusive. */
export function resultsPeriodSpan(period: ResultsPeriod, now: Date = new Date()): DaySpan {
  const today = jalaliToday(now);
  if (period === "year") return fiscalYearDays(today.jy);
  if (period === "last")
    return today.jm === 1 ? jalaliMonthDays(today.jy - 1, 12) : jalaliMonthDays(today.jy, today.jm - 1);
  return jalaliMonthDays(today.jy, today.jm);
}
