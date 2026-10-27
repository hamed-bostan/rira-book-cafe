import { percentChange } from "@/src/domain/entities/Analytics";
import type { Locale } from "@/src/i18n/routing";
import { formatNumber } from "@/src/lib/formatNumber";

const NUMBER_TAG: Record<Locale, string> = { en: "en-US", fa: "fa-IR" };

const changeFormatters = new Map<Locale, Intl.NumberFormat>();

/** "12.4%" — the size of a change, to one decimal at most, in the locale's digits. */
export function formatChange(share: number, locale: Locale): string {
  let formatter = changeFormatters.get(locale);
  if (!formatter) {
    formatter = new Intl.NumberFormat(NUMBER_TAG[locale], { style: "percent", maximumFractionDigits: 1 });
    changeFormatters.set(locale, formatter);
  }
  return formatter.format(share);
}

/**
 * How a figure moved against the period before: which way, and by how much — or
 * `null` when the period before had none, so there's nothing to compare with.
 */
export function changeOf(current: number, previous: number): { up: boolean; share: number } | null {
  const change = percentChange(current, previous);
  return change === null ? null : { up: change >= 0, share: Math.abs(change) };
}

/** An hour under a bar: "8", "10", "2" on a 12-hour clock in English; «۱۴» on a 24-hour one in Persian. */
export function formatHourTick(hour: number, locale: Locale): string {
  return formatNumber(locale === "en" ? hour % 12 || 12 : hour, locale);
}

const hourFormatters = new Map<Locale, Intl.DateTimeFormat>();

/** The hour a bar covers, for its tooltip: "3:00 PM – 4:00 PM" / «۱۵:۰۰ – ۱۶:۰۰». */
export function formatHourSpan(hour: number, locale: Locale): string {
  let formatter = hourFormatters.get(locale);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(NUMBER_TAG[locale], {
      hour: "numeric",
      minute: "2-digit",
      hour12: locale === "en",
      timeZone: "UTC",
    });
    hourFormatters.set(locale, formatter);
  }
  const at = (value: number): string => formatter.format(Date.UTC(2000, 0, 1, value % 24));
  return `${at(hour)} – ${at(hour + 1)}`;
}
