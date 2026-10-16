import { EventsScreen } from "@/src/presentation/storefront/events/EventsScreen";
import { storefrontServerApi } from "@/src/presentation/storefront/storefront-server-api";

export const dynamic = "force-dynamic";

export default async function EventsPage() {
  return <EventsScreen events={await storefrontServerApi.upcomingEvents()} />;
}
