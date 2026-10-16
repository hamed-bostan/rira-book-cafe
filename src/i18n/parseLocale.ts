import { hasLocale } from "next-intl";

import { routing, type Locale } from "./routing";

/**
 * Narrow an untrusted value (e.g. a `?lang=` query param) to a locale the app
 * supports, or `undefined` when it isn't one. Handy in API routes, which sit
 * outside the `[locale]` segment and so can't read the request locale directly.
 */
export function parseLocale(candidate: unknown): Locale | undefined {
  return hasLocale(routing.locales, candidate) ? candidate : undefined;
}
