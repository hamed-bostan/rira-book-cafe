import { getTranslations } from "next-intl/server";

import { pageMetadata } from "@/src/presentation/seo/pageMetadata";
import { EventsScreen } from "@/src/presentation/storefront/events/EventsScreen";
import { storefrontServerApi } from "@/src/presentation/storefront/storefront-server-api";

import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("site");
  return pageMetadata({ title: t("events.heading"), description: t("events.subtitle"), path: "/events" });
}

export default async function EventsPage() {
  return <EventsScreen events={await storefrontServerApi.upcomingEvents()} />;
}
