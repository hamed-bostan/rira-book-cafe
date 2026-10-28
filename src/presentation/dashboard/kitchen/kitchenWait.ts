import type { Locale } from "@/src/i18n/routing";
import { formatNumber } from "@/src/lib/formatNumber";

const MINUTES_PER_HOUR = 60;

/**
 * Which message a wait reads as on a ticket, with its numbers already in the
 * reader's digits: "Just now" under a minute, "12 min" under an hour, then
 * "1 h 5 min".
 */
export type KitchenWaitMessage =
  | { key: "justNow" }
  | { key: "minutes"; values: { minutes: string } }
  | { key: "hours"; values: { hours: string; minutes: string } };

export function kitchenWaitMessage(minutes: number, locale: Locale): KitchenWaitMessage {
  if (minutes < 1) return { key: "justNow" };
  if (minutes < MINUTES_PER_HOUR) return { key: "minutes", values: { minutes: formatNumber(minutes, locale) } };
  return {
    key: "hours",
    values: {
      hours: formatNumber(Math.floor(minutes / MINUTES_PER_HOUR), locale),
      minutes: formatNumber(minutes % MINUTES_PER_HOUR, locale),
    },
  };
}
