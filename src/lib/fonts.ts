import type { Locale } from "@/src/i18n/routing";

/**
 * The font file each locale's text renders in first — the one worth preloading.
 * Persian renders in Vazirmatn; English in Inter's Latin subset. (Inter's Latin
 * Extended file and other faces still load on demand, only when text needs them.)
 * Keep in sync with the @font-face URLs in src/styles/fonts.css.
 */
export const PRIMARY_FONT_URL: Record<Locale, string> = {
  en: "/fonts/inter-latin-variable.c9407645.woff2",
  fa: "/fonts/vazirmatn-variable.4e3fa217.woff2",
};
