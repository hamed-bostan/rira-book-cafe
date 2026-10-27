import { cafeDayOf, cafeDaysBetween, shiftCafeDay } from "@/src/domain/entities/CafeTime";

/** One cafe day of the log, with its entries in the order they came. */
export type ActivityDayGroup<T> = { day: string; entries: T[] };

/** Within this many days a date reads unambiguously without its year ("Oct 20"). */
const RECENT_DAYS = 180;

/**
 * The log split into cafe days, one header per day, so "what happened yesterday"
 * reads as a block rather than as timestamps to compare. The entries arrive
 * newest first, so a day's entries are always next to each other and the order
 * is kept as it is.
 */
export function groupByCafeDay<T extends { at: string }>(entries: readonly T[]): ActivityDayGroup<T>[] {
  const groups: ActivityDayGroup<T>[] = [];
  for (const entry of entries) {
    const day = cafeDayOf(new Date(entry.at));
    const last = groups.at(-1);
    if (last?.day === day) last.entries.push(entry);
    else groups.push({ day, entries: [entry] });
  }
  return groups;
}

/**
 * How a day's header names it, relative to `today`: today and yesterday by
 * name, a recent day by month and day, and an older one with its year too.
 */
export function activityDayKind(day: string, today: string): "today" | "yesterday" | "recent" | "older" {
  if (day === today) return "today";
  if (day === shiftCafeDay(today, -1)) return "yesterday";
  return cafeDaysBetween(day, today) <= RECENT_DAYS ? "recent" : "older";
}
