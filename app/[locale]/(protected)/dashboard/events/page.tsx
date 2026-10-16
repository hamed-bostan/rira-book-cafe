import { auth } from "@/auth";
import { sessionHas } from "@/src/lib/require-permission";
import { eventsServerApi } from "@/src/presentation/dashboard/events/event-server-api";
import { EventsScreen } from "@/src/presentation/dashboard/events/EventsScreen";

// Events are fetched over the REST API (BFF) during server render. Reading the
// list needs only the dashboard; creating and editing need `events.manage`.
export const dynamic = "force-dynamic";

export default async function DashboardEventsPage() {
  const [events, canManage] = await Promise.all([
    eventsServerApi.listAll(),
    auth().then((session) => sessionHas(session, "events.manage")),
  ]);

  return <EventsScreen events={events} canManage={canManage} now={new Date().toISOString()} />;
}
