import { defineRouting } from "next-intl/routing";

// Persisted locale cookie — the single source of truth for the active language.
// Shared with the LocaleSwitcher, which writes the same cookie on the client before
// reloading, so the switcher and the middleware agree on name/lifetime.
export const LOCALE_COOKIE_NAME = "NEXT_LOCALE";
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

// Locale routing config, shared by the middleware, the navigation helpers, and the
// request config.
//
// Locale is a **user preference**, not a property of the URL (`localePrefix: "never"`).
// Every URL is locale-agnostic: the middleware resolves the locale from the persisted
// `NEXT_LOCALE` cookie (falling back to `accept-language`, then the default) and rewrites
// the request internally onto the `[locale]` segment — the browser URL never carries a
// locale. That is what makes the language *sticky*: switching sets the cookie for a year,
// and because the back/forward stack holds only locale-agnostic URLs, every later
// navigation — including the browser Back button — re-renders in the chosen locale.
//
// (The alternative, URL-as-source-of-truth with per-locale paths like `/fa/...`, is
// SEO-friendlier but cannot make a switch persist across Back: the back stack keeps the
// pre-switch URLs, and App Router restores them from its client cache without consulting
// the cookie. For this app-shell-first product, sticky preference wins over per-locale URLs.)
export const routing = defineRouting({
  locales: ["en", "fa"],
  defaultLocale: "en",
  localePrefix: "never",
  localeCookie: {
    name: LOCALE_COOKIE_NAME,
    maxAge: LOCALE_COOKIE_MAX_AGE,
    sameSite: "lax",
  },
});

export type Locale = (typeof routing.locales)[number];
