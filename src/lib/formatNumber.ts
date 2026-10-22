import type { Locale } from "@/src/i18n/routing";

// Single source of truth for presenting a bare number per locale — counts, ranks,
// quantities, ratings:
//   • en → Latin digits ("1", "4.5")
//   • fa → Persian digits and the Persian decimal separator ("۱", "۴٫۵")
//
// Only for numerals rendered straight into JSX. A number that rides *inside* a
// translated sentence is already localized by the message formatter — ICU formats a
// plural's `#` (see `dashOrders.orderCount`), so those need nothing here. A bare
// `{count}` argument, by contrast, is interpolated verbatim: pluralize the message
// rather than reaching for this.
//
// Pure and locale-parameterized, like `formatMoney`: the impure "what is the active
// locale" question is answered in presentation (next-intl `useLocale`/`getLocale`)
// and passed in, so `lib` stays framework-free. Formatters are cached per locale +
// precision; the locale is stable across a server render and its client hydration,
// so output is identical on both sides (no hydration mismatch).

const NUMBER_TAG: Record<Locale, string> = { en: "en-US", fa: "fa-IR" };

const cache = new Map<string, Intl.NumberFormat>();

function getFormatter(locale: Locale, fractionDigits: number): Intl.NumberFormat {
  const key = `${locale}:${fractionDigits}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const formatter = new Intl.NumberFormat(NUMBER_TAG[locale], {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
  cache.set(key, formatter);
  return formatter;
}

/** Format a number for display in the given locale, at a fixed decimal precision. */
export function formatNumber(value: number, locale: Locale, fractionDigits = 0): string {
  return getFormatter(locale, fractionDigits).format(value);
}

/**
 * Format a star rating for the given locale, preserving its natural precision — a
 * whole rating shows no decimals ("۴"), a fractional one shows the single decimal it
 * carries ("۴٫۵"). Ratings are stored as `Math.round(avg * 10) / 10`, so one decimal
 * is the most they ever hold.
 */
export function formatRating(value: number, locale: Locale): string {
  return formatNumber(value, locale, Number.isInteger(value) ? 0 : 1);
}

const compactCache = new Map<Locale, Intl.NumberFormat>();

/** "2.5M", "800K" — for chart axis ticks, where the exact figure lives in the tooltip. */
export function formatCompactNumber(value: number, locale: Locale): string {
  let formatter = compactCache.get(locale);
  if (!formatter) {
    formatter = new Intl.NumberFormat(NUMBER_TAG[locale], { notation: "compact", maximumFractionDigits: 1 });
    compactCache.set(locale, formatter);
  }
  return formatter.format(value);
}
