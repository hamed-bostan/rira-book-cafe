import { getTranslations } from "next-intl/server";

import { pageMetadata } from "@/src/presentation/seo/pageMetadata";
import { HomeScreen } from "@/src/presentation/storefront/home/HomeScreen";
import { storefrontServerApi } from "@/src/presentation/storefront/storefront-server-api";

import type { Metadata } from "next";

// Featured items and upcoming events are read over the REST API (BFF) per request,
// in the guest's language.
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("site");
  return pageMetadata({ path: "/", description: t("home.tagline") });
}

export default async function HomePage() {
  const [featured, events, categories] = await Promise.all([
    storefrontServerApi.featured(),
    storefrontServerApi.upcomingEvents(),
    storefrontServerApi.categories(),
  ]);
  // A featured item in a hidden category stays hidden.
  const activeCategoryIds = new Set(categories.map((category) => category.id));

  return <HomeScreen featured={featured.filter((item) => activeCategoryIds.has(item.categoryId))} events={events} />;
}
