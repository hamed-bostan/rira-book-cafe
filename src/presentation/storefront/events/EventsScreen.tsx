import { getTranslations } from "next-intl/server";

import type { CafeEvent } from "@/src/domain/entities/CafeEvent";

import { EventCard } from "./EventCard";

/** What's on: published events that haven't started, soonest first. */
export async function EventsScreen({ events }: { events: CafeEvent[] }) {
  const t = await getTranslations("site");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-heading-page text-foreground">{t("events.heading")}</h1>
        <p className="mt-1 text-body-small text-muted-foreground">{t("events.subtitle")}</p>
      </div>
      {events.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      ) : (
        <p className="rounded-card-lg border border-dashed border-border px-6 py-16 text-center text-body-small text-muted-foreground">
          {t("events.none")}
        </p>
      )}
    </div>
  );
}
