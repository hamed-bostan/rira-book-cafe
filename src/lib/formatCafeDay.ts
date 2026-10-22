import { CAFE_TIME_ZONE, cafeDayRange } from "@/src/domain/entities/CafeTime";
import type { Locale } from "@/src/i18n/routing";

/**
 * Compact labels for cafe days (`YYYY-MM-DD`) in charts and range captions:
 * "Oct 21" / «۲۹ مهر». Persian uses the Jalali calendar, like every other date.
 */
const TAG: Record<Locale, string> = { en: "en-US", fa: "fa-IR-u-ca-persian" };

const cache = new Map<Locale, { short: Intl.DateTimeFormat; medium: Intl.DateTimeFormat }>();

function formatters(locale: Locale) {
  const cached = cache.get(locale);
  if (cached) return cached;
  const created = {
    short: new Intl.DateTimeFormat(TAG[locale], { day: "numeric", month: "short", timeZone: CAFE_TIME_ZONE }),
    medium: new Intl.DateTimeFormat(TAG[locale], {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: CAFE_TIME_ZONE,
    }),
  };
  cache.set(locale, created);
  return created;
}

/** A noon instant on the day, so the zone conversion can never tip it into a neighbour. */
function noonOf(day: string): Date {
  return new Date(cafeDayRange(day).from.getTime() + 12 * 60 * 60 * 1000);
}

/** "Oct 21" — for chart axes. */
export function formatCafeDayShort(day: string, locale: Locale): string {
  return formatters(locale).short.format(noonOf(day));
}

/** "Oct 21, 2026" — for range captions. */
export function formatCafeDayMedium(day: string, locale: Locale): string {
  return formatters(locale).medium.format(noonOf(day));
}

/** A share 0–1 as a whole percentage, in the locale's digits. */
export function formatPercent(share: number, locale: Locale): string {
  return new Intl.NumberFormat(locale === "fa" ? "fa-IR" : "en-US", {
    style: "percent",
    maximumFractionDigits: 0,
  }).format(share);
}

const longFormatters = new Map<
  Locale,
  { full: Intl.DateTimeFormat; weekday: Intl.DateTimeFormat; long: Intl.DateTimeFormat }
>();

function longFormattersFor(locale: Locale) {
  const cached = longFormatters.get(locale);
  if (cached) return cached;
  const created = {
    full: new Intl.DateTimeFormat(TAG[locale], { dateStyle: "full", timeZone: CAFE_TIME_ZONE }),
    weekday: new Intl.DateTimeFormat(TAG[locale], { weekday: "short", day: "numeric", timeZone: CAFE_TIME_ZONE }),
    long: new Intl.DateTimeFormat(TAG[locale], {
      weekday: "long",
      day: "numeric",
      month: "short",
      timeZone: CAFE_TIME_ZONE,
    }),
  };
  longFormatters.set(locale, created);
  return created;
}

/** "Wednesday, October 21, 2026" — a page's date line. */
export function formatCafeDayFull(day: string, locale: Locale): string {
  return longFormattersFor(locale).full.format(noonOf(day));
}

/** "Thu 15" — a bar's label in a week chart. */
export function formatCafeDayWeekday(day: string, locale: Locale): string {
  return longFormattersFor(locale).weekday.format(noonOf(day));
}

/** "Thursday, Oct 15" — a bar's tooltip title. */
export function formatCafeDayLong(day: string, locale: Locale): string {
  return longFormattersFor(locale).long.format(noonOf(day));
}

const headerFormatters = new Map<Locale, { weekday: Intl.DateTimeFormat; day: Intl.DateTimeFormat }>();

/** "Thu" over "22" — a day column's head in a calendar strip. */
export function formatCafeDayHeader(day: string, locale: Locale): { weekday: string; day: string } {
  let formatters = headerFormatters.get(locale);
  if (!formatters) {
    formatters = {
      weekday: new Intl.DateTimeFormat(TAG[locale], { weekday: "short", timeZone: CAFE_TIME_ZONE }),
      day: new Intl.DateTimeFormat(TAG[locale], { day: "numeric", timeZone: CAFE_TIME_ZONE }),
    };
    headerFormatters.set(locale, formatters);
  }
  const noon = noonOf(day);
  return { weekday: formatters.weekday.format(noon), day: formatters.day.format(noon) };
}
