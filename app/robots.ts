import { getSiteUrl } from "@/src/lib/siteUrl";

import type { MetadataRoute } from "next";

// The sitemap's absolute URL depends on the public origin, resolved per request.
export const dynamic = "force-dynamic";

/**
 * Crawl the public storefront; stay out of the staff dashboard and the REST API
 * (its JSON isn't a page, and every storefront page already renders the data).
 * Uploaded images under `/uploads` stay crawlable for image search.
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const siteUrl = await getSiteUrl();

  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/dashboard", "/api/"] },
    sitemap: new URL("/sitemap.xml", siteUrl).toString(),
  };
}
