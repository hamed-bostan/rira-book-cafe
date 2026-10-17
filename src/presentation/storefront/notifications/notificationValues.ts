import type { Notification } from "@/src/domain/entities/Notification";
import type { Locale } from "@/src/i18n/routing";
import { formatCafeDayMedium } from "@/src/lib/formatCafeDay";
import { formatNumber } from "@/src/lib/formatNumber";
import { formatOrderDate, formatOrderTime } from "@/src/lib/formatOrderDate";

/** Params that hold an instant (ISO timestamp) — shown as a date and time. */
const INSTANT_PARAMS = new Set(["startsAt"]);
/** Params that hold an instant where only the day matters (a loan's due date). */
const DAY_OF_INSTANT_PARAMS = new Set(["dueAt"]);
/** Params that already are a cafe day (`YYYY-MM-DD`). */
const CAFE_DAY_PARAMS = new Set(["checkIn", "checkOut"]);

/**
 * A notification's stored params, formatted for its message in the guest's
 * language: dates on the cafe's calendar (Jalali under `fa`), numbers in the
 * locale's digits. Everything else passes through as text.
 */
export function notificationValues(notification: Notification, locale: Locale): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, value] of Object.entries(notification.params)) {
    if (typeof value === "number") values[key] = formatNumber(value, locale);
    else if (INSTANT_PARAMS.has(key)) values[key] = `${formatOrderDate(value, locale)} ${formatOrderTime(value, locale)}`;
    else if (DAY_OF_INSTANT_PARAMS.has(key)) values[key] = formatOrderDate(value, locale);
    else if (CAFE_DAY_PARAMS.has(key)) values[key] = formatCafeDayMedium(value, locale);
    else values[key] = value;
  }
  return values;
}
