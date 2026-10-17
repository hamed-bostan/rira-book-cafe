import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { auth } from "@/auth";
import { pageMetadata } from "@/src/presentation/seo/pageMetadata";
import { eventDescription, eventTitle } from "@/src/presentation/storefront/eventCopy";
import { EventDetailScreen } from "@/src/presentation/storefront/events/EventDetailScreen";
import { storefrontServerApi } from "@/src/presentation/storefront/storefront-server-api";

import type { Metadata } from "next";

export const dynamic = "force-dynamic";

type EventPageProps = {
  params: Promise<{ id: string }>;
};

/** The event's title and copy in the guest's language; the page body's identical read is memoized. */
export async function generateMetadata({ params }: EventPageProps): Promise<Metadata> {
  const { id } = await params;
  const [event, locale, t] = await Promise.all([storefrontServerApi.event(id), getLocale(), getTranslations("site")]);
  if (!event) return {};

  return pageMetadata({
    title: eventTitle(event, locale),
    description: eventDescription(event, locale) ?? t("events.subtitle"),
    path: `/events/${event.id}`,
  });
}

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
