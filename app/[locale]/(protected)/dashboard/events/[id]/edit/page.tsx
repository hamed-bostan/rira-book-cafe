import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { DEFAULT_ACTIVITY_LIMIT } from "@/src/domain/entities/ActivityEntry";
import { requirePermission } from "@/src/lib/require-permission";
import { activityServerApi } from "@/src/presentation/dashboard/activity/activity-server-api";
import { ActivityPanel } from "@/src/presentation/dashboard/activity/ActivityPanel";
import { DeleteEventButton } from "@/src/presentation/dashboard/events/DeleteEventButton";
import { eventsServerApi } from "@/src/presentation/dashboard/events/event-server-api";
import { EventForm } from "@/src/presentation/dashboard/events/EventForm";
import { EventRegistrationsPanel } from "@/src/presentation/dashboard/events/EventRegistrationsPanel";

export const dynamic = "force-dynamic";

type EditEventPageProps = {
  params: Promise<{ id: string }>;
};

// The event, its guest list and its activity are fetched over the REST API (BFF)
// during server render; a missing event renders the not-found boundary.
export default async function EditEventPage({ params }: EditEventPageProps) {
  await requirePermission("events.manage");
  const t = await getTranslations("dashEvents");

  const { id } = await params;
  const [event, registrations, activity] = await Promise.all([
    eventsServerApi.getById(id),
    eventsServerApi.listRegistrations(id),
    activityServerApi.listForEntity("event", id, DEFAULT_ACTIVITY_LIMIT),
  ]);
  if (!event) notFound();

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div className="flex max-w-xl flex-col gap-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="dashboard-page-title">{t("editHeading")}</h1>
            <p className="text-body-small text-muted-foreground">{event.title}</p>
          </div>
          <DeleteEventButton id={event.id} title={event.title} />
        </div>
        <EventForm mode="edit" event={event} />
        <ActivityPanel entries={activity} />
      </div>
      <div>
        <EventRegistrationsPanel event={event} registrations={registrations} canManage />
      </div>
    </div>
  );
}
