import { notFound } from "next/navigation";

import { auth } from "@/auth";
import { DEFAULT_ACTIVITY_LIMIT } from "@/src/domain/entities/ActivityEntry";
import { cafeDayOf } from "@/src/domain/entities/CafeTime";
import { requirePermission, sessionHas } from "@/src/lib/require-permission";
import { accountsServerApi } from "@/src/presentation/dashboard/accounting/accounting-server-api";
import { activityServerApi } from "@/src/presentation/dashboard/activity/activity-server-api";
import { ActivityPanel } from "@/src/presentation/dashboard/activity/ActivityPanel";
import { CancelEventButton } from "@/src/presentation/dashboard/events/CancelEventButton";
import { eventsServerApi } from "@/src/presentation/dashboard/events/event-server-api";
import { EventForm } from "@/src/presentation/dashboard/events/EventForm";
import { EventRegistrationsPanel } from "@/src/presentation/dashboard/events/EventRegistrationsPanel";
import { DashboardPageCrumb } from "@/src/presentation/dashboard/shell/DashboardPageCrumb";

export const dynamic = "force-dynamic";

type EditEventPageProps = {
  params: Promise<{ id: string }>;
};

// The event, its guest list and its activity are fetched over the REST API (BFF)
// during server render; a missing event renders the not-found boundary. "Now" is
// read here, so whether the event can still be called off is the server's call.
export default async function EditEventPage({ params }: EditEventPageProps) {
  await requirePermission("events.manage");

  const { id } = await params;
  const [event, registrations, activity, session] = await Promise.all([
    eventsServerApi.getById(id),
    eventsServerApi.listRegistrations(id),
    activityServerApi.listForEntity("event", id, DEFAULT_ACTIVITY_LIMIT),
    auth(),
  ]);
  if (!event) notFound();

  // Taking a ticket's money books it, so it follows the books' permission.
  const payment = (await sessionHas(session, "accounting.write"))
    ? { today: cafeDayOf(new Date()), vatRateBps: (await accountsServerApi.getSettings()).vatRateBps }
    : undefined;
  // An event that hasn't ended can be called off while it's on the site or has guests.
  const signedUp = registrations.filter((registration) => registration.status === "registered").length;
  const cancellable = new Date(event.endsAt) > new Date() && (event.isPublished || signedUp > 0);

  return (
    <>
      <DashboardPageCrumb label={event.title} />
      <EventForm
        mode="edit"
        event={event}
        guestList={<EventRegistrationsPanel event={event} registrations={registrations} canManage payment={payment} />}
        activity={<ActivityPanel entries={activity} />}
        cancelAction={
          cancellable ? <CancelEventButton id={event.id} title={event.title} guests={signedUp} /> : undefined
        }
      />
    </>
  );
}
