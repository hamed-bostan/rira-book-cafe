import type { CafeEvent } from "@/src/domain/entities/CafeEvent";
import { cafeDayOf } from "@/src/domain/entities/CafeTime";

/** The element id of an event's card on the events list, so a link from elsewhere can land on it (`#event-…`). */
export function eventCardId(eventId: string): string {
  return `event-${eventId}`;
}

/**
 * Where a link to an event from elsewhere in the dashboard goes: the event's own
 * page for someone who can manage events (`events.manage`), otherwise its card on
 * the events list — under the tab the list files it in (by cafe day, as
 * `EventsScreen` splits them), scrolled to it.
 */
export function dashboardEventHref(
  event: Pick<CafeEvent, "id" | "startsAt">,
  today: string,
  canManageEvents: boolean,
): string {
  if (canManageEvents) return `/dashboard/events/${event.id}/edit`;
  const past = cafeDayOf(new Date(event.startsAt)) < today;
  return `/dashboard/events${past ? "?tab=past" : ""}#${eventCardId(event.id)}`;
}
