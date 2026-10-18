import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { auth } from "@/auth";
import { cafeIdentity } from "@/src/presentation/seo/cafeIdentity";
import { JsonLd } from "@/src/presentation/seo/JsonLd";
import { pageMetadata } from "@/src/presentation/seo/pageMetadata";
import { eventJsonLd } from "@/src/presentation/seo/structuredData";
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

  const title = eventTitle(event, locale);
  return pageMetadata({
    title,
    description: eventDescription(event, locale) ?? t("events.subtitle"),
    path: `/events/${event.id}`,
    image: event.imageUrl ? { url: event.imageUrl, alt: title } : undefined,
  });
}

/** One published event; a signed-in guest also sees their own sign-up for it. */
export default async function EventPage({ params }: EventPageProps) {
  const { id } = await params;
  const session = await auth();
  const signedIn = Boolean(session?.user);

  const [event, registrations, cafe, locale] = await Promise.all([
    storefrontServerApi.event(id),
    signedIn ? storefrontServerApi.myRegistrations() : Promise.resolve([]),
    cafeIdentity(),
    getLocale(),
  ]);
  if (!event) notFound();

  const registration = registrations.find((r) => r.eventId === event.id && r.status === "registered");

  return (
    <>
      <JsonLd
        data={eventJsonLd({
          event,
          title: eventTitle(event, locale),
          description: eventDescription(event, locale),
          url: new URL(`/events/${event.id}`, cafe.url).toString(),
          image: event.imageUrl ? new URL(event.imageUrl, cafe.url).toString() : undefined,
          cafe,
        })}
      />
      <EventDetailScreen event={event} signedIn={signedIn} registration={registration} now={new Date().toISOString()} />
    </>
  );
}
