import { getTranslations } from "next-intl/server";

import { CAFE_LOCATION } from "@/src/lib/cafeLocation";
import { getSiteUrl } from "@/src/lib/siteUrl";

import type { CafeIdentity } from "./structuredData";

/** The cafe as structured data names it: localized name, home URL on the public origin, and its configured location. */
export async function cafeIdentity(): Promise<CafeIdentity> {
  const [t, siteUrl] = await Promise.all([getTranslations("meta"), getSiteUrl()]);
  return { name: t("siteName"), url: new URL("/", siteUrl).toString(), location: CAFE_LOCATION };
}
