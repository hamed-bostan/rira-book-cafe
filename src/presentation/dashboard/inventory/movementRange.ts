import { shiftCafeDay } from "@/src/domain/entities/CafeTime";
import { jalaliMonthDays, toJalali } from "@/src/domain/entities/JalaliCalendar";

/** The spans the movements' date filter offers, besides any pair of days. */
export const MOVEMENT_RANGE_PRESETS = ["all", "thisMonth", "lastMonth", "last30"] as const;
export type MovementRangePreset = (typeof MOVEMENT_RANGE_PRESETS)[number] | "custom";

export type DayRange = { from?: string; to?: string };

/** A Gregorian month's first and last day. */
function gregorianMonth(year: number, month: number): { fromDay: string; toDay: string } {
  const pad = (value: number): string => String(value).padStart(2, "0");
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { fromDay: `${year}-${pad(month)}-01`, toDay: `${year}-${pad(month)}-${pad(last)}` };
}

/**
 * The month `back` months before the one `today` falls in, on the reader's
 * calendar: Persian months in Persian (as the books are kept), Gregorian in English.
 */
function monthOf(today: string, back: number, calendar: "jalali" | "gregorian"): { fromDay: string; toDay: string } {
  if (calendar === "jalali") {
    const { jy, jm } = toJalali(today);
    const index = jy * 12 + (jm - 1) - back;
    return jalaliMonthDays(Math.floor(index / 12), (index % 12) + 1);
  }
  const [year, month] = today.split("-").map(Number);
  const index = year * 12 + (month - 1) - back;
  return gregorianMonth(Math.floor(index / 12), (index % 12) + 1);
}

/** The days a preset covers, as of `today`. "All" is no bounds at all. */
export function rangeForPreset(
  preset: Exclude<MovementRangePreset, "custom">,
  today: string,
  calendar: "jalali" | "gregorian",
): DayRange {
  switch (preset) {
    case "all":
      return {};
    case "thisMonth": {
      const month = monthOf(today, 0, calendar);
      return { from: month.fromDay, to: today };
    }
    case "lastMonth": {
      const month = monthOf(today, 1, calendar);
      return { from: month.fromDay, to: month.toDay };
    }
    case "last30":
      return { from: shiftCafeDay(today, -29), to: today };
  }
}

/** Which preset a range is exactly, or "custom". */
export function presetOf(range: DayRange, today: string, calendar: "jalali" | "gregorian"): MovementRangePreset {
  return (
    MOVEMENT_RANGE_PRESETS.find((preset) => {
      const candidate = rangeForPreset(preset, today, calendar);
      return candidate.from === range.from && candidate.to === range.to;
    }) ?? "custom"
  );
}
