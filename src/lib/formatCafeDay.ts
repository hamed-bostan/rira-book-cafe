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
