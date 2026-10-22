import { auth } from "@/auth";
import { sessionHas } from "@/src/lib/require-permission";
import { eventsServerApi } from "@/src/presentation/dashboard/events/event-server-api";
import { EventsScreen } from "@/src/presentation/dashboard/events/EventsScreen";
import { EVENT_TABS, type EventTab } from "@/src/presentation/dashboard/events/EventTabs";

// Events are fetched over the REST API (BFF) during server render. Reading the
// list needs only the dashboard; creating, editing and holding tables need
// `events.manage`. The Upcoming / Past tab lives in the query string.
export const dynamic = "force-dynamic";

type DashboardEventsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function DashboardEventsPage({ searchParams }: DashboardEventsPageProps) {
  const { tab } = await searchParams;
  const current: EventTab = EVENT_TABS.find((value) => value === tab) ?? "upcoming";

  const [events, canManage] = await Promise.all([
    eventsServerApi.listAll(),
    auth().then((session) => sessionHas(session, "events.manage")),
  ]);

  return <EventsScreen events={events} tab={current} canManage={canManage} now={new Date().toISOString()} />;
}
