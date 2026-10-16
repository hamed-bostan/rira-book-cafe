import type { Locale } from "@/src/i18n/routing";

/** Largest-fitting unit boundaries, smallest → largest. */
const DIVISIONS: { amount: number; unit: Intl.RelativeTimeFormatUnit }[] = [
  { amount: 60, unit: "seconds" },
  { amount: 60, unit: "minutes" },
  { amount: 24, unit: "hours" },
  { amount: 7, unit: "days" },
  { amount: 4.34524, unit: "weeks" },
  { amount: 12, unit: "months" },
  { amount: Number.POSITIVE_INFINITY, unit: "years" },
];

// One formatter per locale — under `fa` this yields Persian phrasing and numerals
// ("۲ هفته پیش"); `en` gives "2 weeks ago".
const cache = new Map<Locale, Intl.RelativeTimeFormat>();

function getFormatter(locale: Locale): Intl.RelativeTimeFormat {
  const cached = cache.get(locale);
  if (cached) return cached;

  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "always" });
  cache.set(locale, rtf);
  return rtf;
}

/**
 * Formats an ISO timestamp as relative time ("2 weeks ago", "3 months ago") in the
 * given locale. `now` is injectable to keep the function pure and testable.
 */
export function formatRelativeTime(iso: string, locale: Locale, now: Date = new Date()): string {
  const rtf = getFormatter(locale);
  let duration = (new Date(iso).getTime() - now.getTime()) / 1000;

  for (const { amount, unit } of DIVISIONS) {
    if (Math.abs(duration) < amount) {
      return rtf.format(Math.round(duration), unit);
    }
    duration /= amount;
  }

  return rtf.format(Math.round(duration), "years");
}
