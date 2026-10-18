import type { Locale } from "@/src/i18n/routing";

/** An Open Graph / Twitter card image: a path (resolved against `metadataBase`) or absolute URL. */
export type ShareImage = {
  url: string;
  alt: string;
  width?: number;
  height?: number;
};

/** The generated brand card at `app/[locale]/opengraph-image.tsx` (1200×630), served per locale segment. */
export function defaultShareImage(locale: Locale, alt: string): ShareImage {
  return { url: `/${locale}/opengraph-image`, alt, width: 1200, height: 630 };
}
