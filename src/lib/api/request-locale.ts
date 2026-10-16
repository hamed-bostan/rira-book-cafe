import { routing } from "@/src/i18n/routing";

import type { NextRequest } from "next/server";

/**
 * Resolve the caller's target locale from the request's `Accept-Language` header —
 * the BFF's language negotiation. The storefront clients send the active locale there
 * (`serverApiGet` from the server render, the browser Axios client from the page), so
 * the route can serve localized catalog content without the locale living in the URL.
 *
 * Returns `undefined` for the default locale or an unsupported/absent value, so the
 * repository serves canonical (default-locale) content and skips the translation query.
 */
export function getRequestLocale(request: NextRequest): string | undefined {
  // First entry only (the app's own clients send a single bare tag); strip any
  // `;q=` weight so a header like `fa;q=0.9,en;q=0.8` still negotiates `fa`.
  const tag = (request.headers.get("accept-language") ?? "")
    .split(",")[0]
    ?.split(";")[0]
    ?.trim()
    .toLowerCase();
  const base = tag?.split("-")[0] ?? "";
  if (!base || base === routing.defaultLocale) return undefined;
  return (routing.locales as readonly string[]).includes(base) ? base : undefined;
}
