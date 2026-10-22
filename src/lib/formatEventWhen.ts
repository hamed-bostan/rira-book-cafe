import { CAFE_TIME_ZONE } from "@/src/domain/entities/CafeTime";
import type { Locale } from "@/src/i18n/routing";

// When an event runs, on the cafe's wall clock — "Thursday, October 29 · 6:30 PM –
// 8:30 PM". Events sit within the next few weeks, so the year is left out, and the
// hour isn't zero-padded. Under `fa`, the Jalali calendar, Persian numerals and a
// 24-hour clock, as `formatOrderDate` does.

const INTL_LOCALE: Record<Locale, string> = {
  en: "en-US",
  fa: "fa-IR-u-ca-persian",
};

type EventFormatters = {
  long: Intl.DateTimeFormat;
  short: Intl.DateTimeFormat;
  time: Intl.DateTimeFormat;
};

const cache = new Map<Locale, EventFormatters>();

function getFormatters(locale: Locale): EventFormatters {
  const cached = cache.get(locale);
  if (cached) return cached;

  const tag = INTL_LOCALE[locale];
  const formatters: EventFormatters = {
    long: new Intl.DateTimeFormat(tag, { weekday: "long", month: "long", day: "numeric", timeZone: CAFE_TIME_ZONE }),
    short: new Intl.DateTimeFormat(tag, {
      weekday: "short",
      month: "short",
      day: "numeric",
      timeZone: CAFE_TIME_ZONE,
    }),
    time: new Intl.DateTimeFormat(tag, {
      hour: "numeric",
      minute: "2-digit",
      hour12: locale === "en",
      timeZone: CAFE_TIME_ZONE,
    }),
  };
  cache.set(locale, formatters);
  return formatters;
}

/** "6:30 PM" (en) / "۱۸:۳۰" (fa). */
export function formatEventTime(iso: string, locale: Locale): string {
  return getFormatters(locale).time.format(new Date(iso));
}

/**
 * The day and the time range: "Thursday, October 29 · 6:30 PM – 8:30 PM", or with
 * `short` "Thu, Oct 29 · 6:30 PM – 8:30 PM" for a dialog's subtitle.
 */
export function formatEventWhen(
  startsAt: string,
  endsAt: string,
  locale: Locale,
  style: "long" | "short" = "long",
): string {
  const f = getFormatters(locale);
  return `${f[style].format(new Date(startsAt))} · ${f.time.format(new Date(startsAt))} – ${f.time.format(new Date(endsAt))}`;
}
