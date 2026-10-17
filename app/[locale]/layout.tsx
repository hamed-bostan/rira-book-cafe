import { Inter } from "next/font/google";
import localFont from "next/font/local";
import { notFound } from "next/navigation";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { getLangDir } from "@/src/i18n/direction";
import { routing } from "@/src/i18n/routing";
import { getSiteUrl } from "@/src/lib/siteUrl";
import { DirectionProvider } from "@/src/presentation/components/DirectionProvider";

import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@/src/styles/globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

// One self-hosted variable WOFF2 covers every UI weight and mixed Persian/Latin text.
const vazirmatn = localFont({
  src: "../../src/shared/fonts/Vazirmatn[wght].woff2",
  weight: "100 900",
  style: "normal",
  display: "swap",
  variable: "--font-vazirmatn",
});

export function generateStaticParams(): { locale: string }[] {
  return routing.locales.map((locale) => ({ locale }));
}

/**
 * Per-locale document metadata: a localized title (+ template for child pages) and
 * description. Locale is negotiated per request from the `NEXT_LOCALE` cookie, so a page
 * lives at a single locale-agnostic URL (no per-locale paths → no `hreflang` alternates);
 * the served `<html lang>` and copy reflect the active locale. `openGraph.locale` still
 * advertises that language. Pages add their own canonical URL and Open Graph data
 * (`src/presentation/seo/pageMetadata.ts`), resolved against `metadataBase` — the public
 * origin from `getSiteUrl`.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: requested } = await params;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  const t = await getTranslations({ locale, namespace: "meta" });
  const isFa = locale === "fa";

  return {
    metadataBase: await getSiteUrl(),
    title: { default: t("title"), template: t("titleTemplate") },
    description: t("description"),
    applicationName: t("siteName"),
    openGraph: {
      type: "website",
      siteName: t("siteName"),
      title: t("title"),
      description: t("description"),
      locale: isFa ? "fa_IR" : "en_US",
      alternateLocale: isFa ? "en_US" : "fa_IR",
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // A first path segment that isn't a known locale has no valid render.
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  // Opt this locale's routes into static rendering (next-intl reads the locale here).
  setRequestLocale(locale);

  return (
    <html
      lang={locale}
      dir={getLangDir(locale)}
      className={`${inter.variable} ${vazirmatn.variable}`}
    >
      <body className="font-sans">
        {/* Locale + messages are inherited from the request config (src/i18n/request.ts). */}
        <NextIntlClientProvider>
          {/* Reading direction for every Radix primitive (Radix reads this context,
              not the DOM `dir`), so RTL under `fa` flips roving focus + alignment
              app-wide — no per-component `dir` prop needed. */}
          <DirectionProvider dir={getLangDir(locale)}>{children}</DirectionProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
