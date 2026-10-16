import type { Locale } from "@/src/i18n/routing";

// Deterministic, locale-aware order date/time formatting. A fixed UTC time zone
// keeps output identical on the server and its client hydration (no mismatch).
// Under `fa` the Persian (Jalali) calendar and Persian numerals come from the
// `fa-IR-u-ca-persian` BCP-47 tag — `Intl` does the Gregorian→Jalali conversion
// natively, so no extra date library is needed. `en` stays Gregorian/Latin.

// App locale → BCP-47 tag selecting its calendar + numbering system.
const INTL_LOCALE: Record<Locale, string> = {
  en: "en-US",
  fa: "fa-IR-u-ca-persian",
};

type OrderFormatters = {
  weekday: Intl.DateTimeFormat;
  month: Intl.DateTimeFormat;
  monthShort: Intl.DateTimeFormat;
  day: Intl.DateTimeFormat;
  year: Intl.DateTimeFormat;
  time: Intl.DateTimeFormat;
};

// Formatters are relatively costly to build, so cache one set per locale.
const cache = new Map<Locale, OrderFormatters>();

function getFormatters(locale: Locale): OrderFormatters {
  const cached = cache.get(locale);
  if (cached) return cached;

  const tag = INTL_LOCALE[locale];
  const formatters: OrderFormatters = {
    weekday: new Intl.DateTimeFormat(tag, { weekday: "long", timeZone: "UTC" }),
    month: new Intl.DateTimeFormat(tag, { month: "long", timeZone: "UTC" }),
    monthShort: new Intl.DateTimeFormat(tag, { month: "short", timeZone: "UTC" }),
    day: new Intl.DateTimeFormat(tag, { day: "numeric", timeZone: "UTC" }),
    year: new Intl.DateTimeFormat(tag, { year: "numeric", timeZone: "UTC" }),
    // `fa` uses a 24-hour clock (idiomatic in Iran, and avoids the long
    // "بعدازظهر" day-period marker overflowing tight time rows); `en` keeps 12-hour.
    time: new Intl.DateTimeFormat(tag, {
      hour: "2-digit",
      minute: "2-digit",
      hour12: locale === "en",
      timeZone: "UTC",
    }),
  };
  cache.set(locale, formatters);
  return formatters;
}

/** "03:22 PM" (en) — Persian numerals, 24-hour clock under `fa` ("۱۵:۲۲"). */
export function formatOrderTime(iso: string, locale: Locale): string {
  return getFormatters(locale).time.format(new Date(iso));
}

/**
 * "Oct 9, 2023" (en); "۹ مهر ۱۴۰۲" under `fa`.
 *
 * The column form: a table row shows a date beside six other facts, and the
 * weekday that helps on an order's own page is noise in a list sorted by date.
 * Composed in each locale's natural order for the same reason `formatOrderDate`
 * is — Persian puts the day before the month, and swapping the parts of an
 * English template around would produce a date that reads as broken.
 */
export function formatOrderDateShort(iso: string, locale: Locale): string {
  const date = new Date(iso);
  const f = getFormatters(locale);
  if (locale === "fa") {
    return `${f.day.format(date)} ${f.monthShort.format(date)} ${f.year.format(date)}`;
  }
  return `${f.monthShort.format(date)} ${f.day.format(date)}, ${f.year.format(date)}`;
}

/**
 * "Monday - October 9,2023" (en). Under `fa`, the Jalali calendar with Persian
 * numerals composed in natural Persian order — weekday day month year
 * ("یکشنبه ۲۱ تیر ۱۴۰۵") — rather than the English dash/comma layout.
 */
export function formatOrderDate(iso: string, locale: Locale): string {
  const date = new Date(iso);
  const f = getFormatters(locale);
  if (locale === "fa") {
    return `${f.weekday.format(date)} ${f.day.format(date)} ${f.month.format(date)} ${f.year.format(date)}`;
  }
  return `${f.weekday.format(date)} - ${f.month.format(date)} ${f.day.format(date)},${f.year.format(date)}`;
}

// Separate tag set from `INTL_LOCALE` above: this pair renders a compact
// "1 Jul 2026" + "3:22 PM" for dense table rows (inventory movements, reviews) —
// `en-GB` orders the date day-first to match, `en-US` keeps the 12-hour clock.
const COMPACT_DATE_TAG: Record<Locale, string> = { en: "en-GB", fa: "fa-IR-u-ca-persian" };
const COMPACT_TIME_TAG: Record<Locale, string> = { en: "en-US", fa: "fa-IR-u-ca-persian" };

const compactCache = new Map<Locale, { date: Intl.DateTimeFormat; time: Intl.DateTimeFormat }>();

function getCompactFormatters(locale: Locale): { date: Intl.DateTimeFormat; time: Intl.DateTimeFormat } {
  const cached = compactCache.get(locale);
  if (cached) return cached;

  const formatters = {
    date: new Intl.DateTimeFormat(COMPACT_DATE_TAG[locale], { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }),
    time: new Intl.DateTimeFormat(COMPACT_TIME_TAG[locale], { hour: "2-digit", minute: "2-digit", hour12: locale === "en", timeZone: "UTC" }),
  };
  compactCache.set(locale, formatters);
  return formatters;
}

/** Date and time as separate compact parts — "1 Jul 2026" / "3:22 PM" — for dense table rows. */
export function formatCompactDateTime(iso: string, locale: Locale): { date: string; time: string } {
  const date = new Date(iso);
  const f = getCompactFormatters(locale);
  return { date: f.date.format(date), time: f.time.format(date) };
}
