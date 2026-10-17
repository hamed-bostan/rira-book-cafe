import { getLocale, getTranslations } from "next-intl/server";

import type { Locale } from "@/src/i18n/routing";

import { defaultShareImage, type ShareImage } from "./shareImage";
import { toSnippet } from "./toSnippet";

import type { Metadata } from "next";

/** Open Graph locale tags (`language_TERRITORY`) per app locale. */
const OG_LOCALES: Record<Locale, string> = { en: "en_US", fa: "fa_IR" };

type PageMetadataInput = {
  /** The page's own title; the root layout's template appends the site name. Omit for the site title. */
  title?: string;
  /** Snippet copy; falls back to the site description. Long text is trimmed to a snippet. */
  description?: string;
  /** The page's canonical path (`/menu/abc`), resolved against `metadataBase`. */
  path: string;
  /** The share-card image (an item's or event's photo); defaults to the generated brand card. */
  image?: ShareImage;
};

/**
 * Metadata for an indexable public page: title, description, canonical URL and the
 * Open Graph basics. URLs are locale-agnostic (the locale is a cookie preference,
 * see `src/i18n/routing.ts`), so one canonical URL serves every language — there
 * are no per-locale alternates to advertise.
 *
 * `openGraph` is rebuilt in full on every page because Next merges metadata
 * shallowly: a page's `openGraph` replaces the layout's rather than extending it.
 */
export async function pageMetadata({ title, description, path, image }: PageMetadataInput): Promise<Metadata> {
  const locale = await getLocale();
  const t = await getTranslations("meta");
  const snippet = toSnippet(description ?? t("description"));

  return {
    title,
    description: snippet,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      siteName: t("siteName"),
      title: title ?? t("title"),
      description: snippet,
      url: path,
      locale: OG_LOCALES[locale],
      alternateLocale: Object.entries(OG_LOCALES)
        .filter(([other]) => other !== locale)
        .map(([, tag]) => tag),
      images: [image ?? defaultShareImage(locale, t("siteName"))],
    },
    // Title, description and image are inherited from `openGraph`.
    twitter: { card: "summary_large_image" },
  };
}
