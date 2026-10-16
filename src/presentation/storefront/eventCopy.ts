import type { CafeEvent } from "@/src/domain/entities/CafeEvent";

/** An event's title in the guest's language, falling back to the base copy. */
export function eventTitle(event: Pick<CafeEvent, "title" | "titleFa">, locale: string): string {
  return locale === "fa" && event.titleFa ? event.titleFa : event.title;
}

/** An event's description in the guest's language, falling back to the base copy. */
export function eventDescription(event: Pick<CafeEvent, "description" | "descriptionFa">, locale: string): string | undefined {
  return locale === "fa" && event.descriptionFa ? event.descriptionFa : event.description;
}
