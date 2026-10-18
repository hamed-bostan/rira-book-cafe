"use client";

import { Check, ChevronDown } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import * as React from "react";

import { LOCALE_COOKIE_MAX_AGE, LOCALE_COOKIE_NAME, routing, type Locale } from "@/src/i18n/routing";
import { cn } from "@/src/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Icon,
  Spinner,
  focusRing,
} from "@/src/presentation/design-system";

// Each language is labelled with its own endonym — see `LocaleSwitcher` (the
// settings-page counterpart this mirrors) for why it isn't routed through the
// message catalog.
const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  fa: "فارسی",
};

/**
 * Compact locale pill for the dashboard top bar. Same persisted-cookie-then-reload
 * mechanics as `LocaleSwitcher`; a smaller, label-less sibling for chrome that has
 * no room for a full settings row.
 */
export function LocaleToggle() {
  const t = useTranslations("common");
  const locale = useLocale();
  const [pending, setPending] = React.useState(false);

  function handleChange(next: string): void {
    if (!next || next === locale) return;

    setPending(true);
    // Browser-owned preference; the reload lets the server render the new locale atomically.
    // eslint-disable-next-line react-hooks/immutability
    document.cookie = `${LOCALE_COOKIE_NAME}=${next}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; samesite=lax`;
    window.location.reload();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {/* The accessible name keeps the visible language name in it ("Change language:
            English"), so a voice-control user can say what they see (WCAG 2.5.3). */}
        <button
          type="button"
          disabled={pending}
          aria-busy={pending || undefined}
          className={cn(
            "inline-flex h-11 min-w-24 items-center justify-between gap-2 rounded-input border border-border bg-background px-3 text-body-small-bold text-foreground transition-colors hover:bg-muted",
            focusRing,
            "disabled:cursor-not-allowed disabled:opacity-50",
          )}
        >
          <span>
            <span className="sr-only">{t("languageAria")}: </span>
            {LOCALE_NAMES[locale]}
          </span>
          {/* Busy while the page reloads into the new language. */}
          {pending ? (
            <Spinner decorative size="xs" className="text-muted-foreground" />
          ) : (
            <Icon icon={ChevronDown} size="xs" className="text-muted-foreground" />
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-32">
        {routing.locales.map((option) => (
          <DropdownMenuItem key={option} onSelect={() => handleChange(option)} className="justify-between gap-4">
            <span>{LOCALE_NAMES[option]}</span>
            {locale === option ? <Icon icon={Check} size="xs" className="text-primary" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
