import { weekStart, type ReportCalendar } from "@/src/domain/entities/Analytics";
import { cafeDayRange, shiftCafeDay } from "@/src/domain/entities/CafeTime";
import { fromJalali, jalaliMonthLength, toJalali } from "@/src/domain/entities/JalaliCalendar";

/**
 * The month grid behind the range picker, on either calendar. Days are cafe days
 * (`YYYY-MM-DD`, Gregorian) whatever calendar draws them, so a picked range goes
 * straight into the URL; only the grid's months and numbers follow the reader's
 * calendar. Weeks start on Saturday, as in Iran — the same week "This week" means.
 */

/** A month on a calendar: its year and month number (1–12). */
export type CalendarMonth = { year: number; month: number };

/** Days in a week row. */
const WEEK = 7;

/** The month `day` falls in, on `calendar`. */
export function calendarMonthOf(day: string, calendar: ReportCalendar): CalendarMonth {
  if (calendar === "jalali") {
    const { jy, jm } = toJalali(day);
    return { year: jy, month: jm };
  }
  return { year: Number(day.slice(0, 4)), month: Number(day.slice(5, 7)) };
}

/** The month `offset` months from `month` (negative goes back). */
export function shiftMonth(month: CalendarMonth, offset: number): CalendarMonth {
  const index = month.year * 12 + (month.month - 1) + offset;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

/** The first and last cafe day of a month. */
export function monthBounds(month: CalendarMonth, calendar: ReportCalendar): { first: string; last: string } {
  if (calendar === "jalali") {
    return {
      first: fromJalali(month.year, month.month, 1),
      last: fromJalali(month.year, month.month, jalaliMonthLength(month.year, month.month)),
    };
  }
  const prefix = `${String(month.year).padStart(4, "0")}-${String(month.month).padStart(2, "0")}-`;
  const length = new Date(Date.UTC(month.year, month.month, 0)).getUTCDate();
  return { first: `${prefix}01`, last: `${prefix}${String(length).padStart(2, "0")}` };
}

/** A day's number within its month, on `calendar` (1–31). */
export function dayOfMonth(day: string, calendar: ReportCalendar): number {
  return calendar === "jalali" ? toJalali(day).jd : Number(day.slice(8, 10));
}

/**
 * The month as week rows, Saturday first: each cell a cafe day of the month, or
 * `null` for the blanks before the 1st and after the last day.
 */
export function monthWeeks(month: CalendarMonth, calendar: ReportCalendar): (string | null)[][] {
  const { first, last } = monthBounds(month, calendar);
  const cells: (string | null)[] = [];
  for (let day = weekStart(first); day < first; day = shiftCafeDay(day, 1)) cells.push(null);
  for (let day = first; day <= last; day = shiftCafeDay(day, 1)) cells.push(day);
  while (cells.length % WEEK !== 0) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let index = 0; index < cells.length; index += WEEK) weeks.push(cells.slice(index, index + WEEK));
  return weeks;
}

/** The seven days of a week starting on a Saturday — to name the grid's columns. */
export function weekdayColumns(): string[] {
  // 2026-10-17 was a Saturday.
  return Array.from({ length: WEEK }, (_, index) => shiftCafeDay("2026-10-17", index));
}

/**
 * The picked span after a click on `day`: the first click (or one after a complete
 * span) starts a new span; the second ends it, swapped if it falls before the start.
 */
export function pickDay(
  current: { from: string | null; to: string | null },
  day: string,
): { from: string; to: string | null } {
  if (!current.from || current.to) return { from: day, to: null };
  return day < current.from ? { from: day, to: current.from } : { from: current.from, to: day };
}

/** Noon on a cafe day, so formatting it in the cafe's zone can't tip it into a neighbour. */
export function noonOf(day: string): Date {
  return new Date(cafeDayRange(day).from.getTime() + 12 * 60 * 60 * 1000);
}
