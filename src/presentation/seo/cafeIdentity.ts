import { getLocale, getTranslations } from "next-intl/server";

import { inLanguage } from "@/src/domain/entities/CafeSettings";
import { cafeLocationFrom } from "@/src/lib/cafeLocation";
import { getSiteUrl } from "@/src/lib/siteUrl";
import { cafeSettingsServerApi } from "@/src/presentation/settings/cafe-settings-server-api";

import type { CafeIdentity } from "./structuredData";

/**
 * The cafe as structured data names it: its name in the page's language (the
 * site's own name until one is set), home URL on the public origin, and the
 * location its settings give.
 */
export async function cafeIdentity(): Promise<CafeIdentity> {
  const [t, locale, siteUrl, settings] = await Promise.all([
    getTranslations("meta"),
    getLocale(),
    getSiteUrl(),
    cafeSettingsServerApi.getOrEmpty(),
  ]);
  return {
    name: inLanguage(locale, settings.profile.name, settings.profile.nameFa) ?? t("siteName"),
    url: new URL("/", siteUrl).toString(),
    location: cafeLocationFrom(settings, locale),
  };
}
