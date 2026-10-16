import { NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";

import { routing } from "@/src/i18n/routing";

/**
 * Request proxy (Next 16's rename of "middleware"; always runs on the Node.js
 * runtime). Composes two concerns — browsing is never blocked:
 *
 * 1. Locale routing (next-intl) — resolves the locale from the `NEXT_LOCALE` cookie
 *    (then `accept-language`, then the default) and rewrites the request internally
 *    onto the `[locale]` segment. URLs are locale-agnostic (`localePrefix: "never"`).
 * 2. Exposes the current path as `x-pathname` so server-side guards (account and
 *    dashboard routes) can build an accurate `callbackUrl`.
 *
 * Auth is NOT enforced here — protected routes guard themselves server-side via
 * `requireAuth()` / `requirePermission()`.
 */
const handleI18nRouting = createMiddleware(routing);

export function proxy(request: NextRequest) {
  // next-intl copies the incoming request headers onto the request it forwards, so
  // setting this on a cloned request propagates it through the locale rewrite.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", request.nextUrl.pathname);

  return handleI18nRouting(new NextRequest(request, { headers: requestHeaders }));
}

export const config = {
  // App routes only — skip Next internals, API routes, and any file with an extension.
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
