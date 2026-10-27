import { CAFE_TIME_ZONE, cafeDayRange } from "@/src/domain/entities/CafeTime";
import type { Locale } from "@/src/i18n/routing";

/** The Persian calendar in the reader's language: "Aban" / «آبان». */
const MONTH_TAG: Record<Locale, string> = { en: "en-US-u-ca-persian", fa: "fa-IR-u-ca-persian" };

/**
 * The name of the Persian month a cafe day falls in — the cafe's accounting
 * month, in either language ("Recorded in Aban").
 */
export function formatPersianMonth(day: string, locale: Locale): string {
  const noon = new Date(cafeDayRange(day).from.getTime() + 12 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat(MONTH_TAG[locale], { month: "long", timeZone: CAFE_TIME_ZONE }).format(noon);
}

/**
 * An amount as typed, the way the API reads it: Persian or Arabic digits made
 * Latin and thousands separators dropped, so "۱٬۲۰۰٬۰۰۰" and "1,200,000" both
 * arrive as "1200000".
 */
export function normalizeAmount(text: string): string {
  return text
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
    .replace(/[,\s٬]/g, "");
}
