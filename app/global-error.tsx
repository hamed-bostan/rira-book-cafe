"use client";

import { CloudOff, RotateCcw } from "lucide-react";
import { useSyncExternalStore } from "react";

import { LOCALE_COOKIE_NAME, routing } from "@/src/i18n/routing";
import { Button, EmptyState, Icon } from "@/src/presentation/design-system";
import "@/src/styles/globals.css";

/**
 * The copy lives here rather than in `messages/`: this boundary replaces the root
 * layout, so there is no intl provider above it, and it ships in the root client
 * bundle — importing the full message catalogues would add them to every page.
 * Keep it in step with the `errors` namespace in messages/*.json.
 */
const COPY = {
  en: {
    title: "Something went wrong",
    body: "The app hit an unexpected error. Try again, or come back in a moment.",
    retry: "Try again",
    reference: "Error reference:",
  },
  fa: {
    title: "مشکلی پیش آمد",
    body: "برنامه با خطای غیرمنتظره‌ای روبه‌رو شد. دوباره تلاش کنید یا کمی بعد برگردید.",
    retry: "تلاش مجدد",
    reference: "کد پیگیری خطا:",
  },
} as const;

type CopyLocale = keyof typeof COPY;

function readLocaleCookie(): CopyLocale {
  const match = document.cookie.match(new RegExp(`(?:^|; )${LOCALE_COOKIE_NAME}=([^;]+)`));
  return match?.[1] === "fa" ? "fa" : "en";
}

function noopSubscribe(): () => void {
  return () => {};
}

/**
 * Last-resort boundary for an error in the root layout itself. Renders its own
 * document (Next requires `<html>`/`<body>` here) with the same design tokens,
 * localized from the locale cookie the app already sets.
 */
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  // The cookie is only readable in the browser; the server pass (and hydration)
  // uses the default locale, then the client settles on the guest's language.
  const locale = useSyncExternalStore(noopSubscribe, readLocaleCookie, () => routing.defaultLocale);
  const copy = COPY[locale];

  return (
    <html lang={locale} dir={locale === "fa" ? "rtl" : "ltr"}>
      <body className="font-sans">
        <title>{copy.title}</title>
        <main className="flex min-h-dvh flex-col items-center justify-center">
          <EmptyState
            size="page"
            tone="error"
            icon={CloudOff}
            title={copy.title}
            description={
              <>
                {copy.body}
                {error.digest ? (
                  <span className="mt-2 block text-body-caption" dir="ltr">
                    {copy.reference} {error.digest}
                  </span>
                ) : null}
              </>
            }
            action={
              <Button type="button" size="sm" onClick={retry}>
                <Icon icon={RotateCcw} size="sm" className="me-1.5" />
                {copy.retry}
              </Button>
            }
          />
        </main>
      </body>
    </html>
  );
}
