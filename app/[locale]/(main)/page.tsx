import { getLocale, getTranslations } from "next-intl/server";

import { cafeIdentity } from "@/src/presentation/seo/cafeIdentity";
import { JsonLd } from "@/src/presentation/seo/JsonLd";
import { pageMetadata } from "@/src/presentation/seo/pageMetadata";
import { defaultShareImage } from "@/src/presentation/seo/shareImage";
import { cafeJsonLd } from "@/src/presentation/seo/structuredData";
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
  const [featured, events, categories, cafe, locale, t] = await Promise.all([
    storefrontServerApi.featured(),
    storefrontServerApi.upcomingEvents(),
    storefrontServerApi.categories(),
    cafeIdentity(),
    getLocale(),
    getTranslations("site"),
  ]);
  // A featured item in a hidden category stays hidden.
  const activeCategoryIds = new Set(categories.map((category) => category.id));

  return (
    <>
      <JsonLd
        data={cafeJsonLd({
          ...cafe,
          description: t("home.tagline"),
          image: new URL(defaultShareImage(locale, cafe.name).url, cafe.url).toString(),
        })}
      />
      <HomeScreen featured={featured.filter((item) => activeCategoryIds.has(item.categoryId))} events={events} />
    </>
  );
}
