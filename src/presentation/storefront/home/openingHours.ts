import type { Locale } from "@/src/i18n/routing";
import type { OpeningHoursRule, Weekday } from "@/src/lib/cafeLocation";

/** One printable row of the hours table, e.g. { days: "Mon – Fri", hours: "7:00 AM – 7:00 PM" }. */
export type OpeningHoursLine = { days: string; hours: string };

const LOCALE_TAG: Record<Locale, string> = { en: "en-US", fa: "fa-IR" };

const WEEK: readonly Weekday[] = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

// 2024-01-01 was a Monday; day names and clock times are read off fixed UTC dates.
const MONDAY = Date.UTC(2024, 0, 1);
const DAY_MS = 86_400_000;

function dayName(day: Weekday, locale: Locale): string {
  return new Intl.DateTimeFormat(LOCALE_TAG[locale], { weekday: "short", timeZone: "UTC" }).format(
    MONDAY + WEEK.indexOf(day) * DAY_MS,
  );
}

function clock(time: string, locale: Locale): string {
  const [hours, minutes] = time.split(":").map(Number);
  return new Intl.DateTimeFormat(LOCALE_TAG[locale], { hour: "numeric", minute: "2-digit", timeZone: "UTC" }).format(
    Date.UTC(2024, 0, 1, hours, minutes),
  );
}

/** Whether the days follow one another through the week, wrapping Sunday → Monday. */
function isRun(days: Weekday[]): boolean {
  return days.every((day, i) => i === 0 || WEEK.indexOf(day) === (WEEK.indexOf(days[i - 1]) + 1) % WEEK.length);
}

function dayLabel(days: Weekday[], locale: Locale): string {
  const names = days.map((day) => dayName(day, locale));
  if (names.length > 2 && isRun(days)) return `${names[0]} – ${names[names.length - 1]}`;
  return names.join(locale === "fa" ? "، " : ", ");
}

/** The cafe's opening hours as rows of localized day ranges and clock times. */
export function openingHoursLines(rules: OpeningHoursRule[], locale: Locale): OpeningHoursLine[] {
  return rules
    .filter((rule) => rule.days.length > 0)
    .map((rule) => ({
      days: dayLabel(rule.days, locale),
      hours: `${clock(rule.opens, locale)} – ${clock(rule.closes, locale)}`,
    }));
}
