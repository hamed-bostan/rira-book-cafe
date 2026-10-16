import { notFound } from "next/navigation";

import { auth } from "@/auth";
import { EventDetailScreen } from "@/src/presentation/storefront/events/EventDetailScreen";
import { storefrontServerApi } from "@/src/presentation/storefront/storefront-server-api";

export const dynamic = "force-dynamic";

type EventPageProps = {
  params: Promise<{ id: string }>;
};

/** One published event; a signed-in guest also sees their own sign-up for it. */
export default async function EventPage({ params }: EventPageProps) {
  const { id } = await params;
  const session = await auth();
  const signedIn = Boolean(session?.user);

  const [event, registrations] = await Promise.all([
    storefrontServerApi.event(id),
    signedIn ? storefrontServerApi.myRegistrations() : Promise.resolve([]),
  ]);
  if (!event) notFound();

  const registration = registrations.find((r) => r.eventId === event.id && r.status === "registered");

  return <EventDetailScreen event={event} signedIn={signedIn} registration={registration} now={new Date().toISOString()} />;
}
