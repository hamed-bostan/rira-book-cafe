import { getSiteUrl } from "@/src/lib/siteUrl";
import { storefrontServerApi } from "@/src/presentation/storefront/storefront-server-api";

import type { MetadataRoute } from "next";

// Built per request from the live catalog (over the BFF, like every other read), so a
// new item or event is listed as soon as it's published.
export const dynamic = "force-dynamic";

/**
 * Every indexable public URL: the landing pages, each category's menu, each
 * published item and each upcoming event. URLs are locale-agnostic (the language is
 * a cookie preference, see `src/i18n/routing.ts`), so each page is listed once — one
 * URL serves every locale. `lastModified` is only given where the data really has it.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [siteUrl, categories, items, events] = await Promise.all([
    getSiteUrl(),
    storefrontServerApi.categories(),
    storefrontServerApi.menu(),
    storefrontServerApi.upcomingEvents(),
  ]);
  const url = (path: string): string => new URL(path, siteUrl).toString();

  // Items in a hidden category are hidden from guests, so they're left out here too.
  const activeCategoryIds = new Set(categories.map((category) => category.id));
  const listedItems = items.filter((item) => activeCategoryIds.has(item.categoryId));
  const stockedCategoryIds = new Set(listedItems.map((item) => item.categoryId));

  return [
    { url: url("/"), changeFrequency: "daily", priority: 1 },
    { url: url("/menu"), changeFrequency: "daily", priority: 0.9 },
    { url: url("/events"), changeFrequency: "daily", priority: 0.8 },
    ...categories
      .filter((category) => stockedCategoryIds.has(category.id))
      .map((category) => ({
        url: url(`/menu?category=${encodeURIComponent(category.id)}`),
        changeFrequency: "weekly" as const,
        priority: 0.7,
      })),
    ...listedItems.map((item) => ({
      url: url(`/menu/${item.id}`),
      changeFrequency: "weekly" as const,
      priority: 0.6,
      images: item.imageUrl ? [url(item.imageUrl)] : undefined,
    })),
    ...events.map((event) => ({
      url: url(`/events/${event.id}`),
      lastModified: event.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.6,
      images: event.imageUrl ? [url(event.imageUrl)] : undefined,
    })),
  ];
}
