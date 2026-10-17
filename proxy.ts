import { NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";

import { routing } from "@/src/i18n/routing";
import { buildContentSecurityPolicy, generateNonce, originOf } from "@/src/lib/security/content-security-policy";

/**
 * Request proxy (Next 16's rename of "middleware"; always runs on the Node.js
 * runtime). Composes these concerns — browsing is never blocked:
 *
 * 1. Locale routing (next-intl) — resolves the locale from the `NEXT_LOCALE` cookie
 *    (then `accept-language`, then the default) and rewrites the request internally
 *    onto the `[locale]` segment. URLs are locale-agnostic (`localePrefix: "never"`).
 * 2. Exposes the current path as `x-pathname` so server-side guards (account and
 *    dashboard routes) can build an accurate `callbackUrl`.
 * 3. A per-request nonce Content-Security-Policy. Set on the *request* too: Next.js
 *    reads the nonce back from it while rendering and stamps it on its own scripts.
 *    This only works for dynamically rendered pages — see `app/[locale]/layout.tsx`.
 *
 * Auth is NOT enforced here — protected routes guard themselves server-side via
 * `requireAuth()` / `requirePermission()`.
 */
const handleI18nRouting = createMiddleware(routing);

const API_ORIGIN = originOf(process.env.NEXT_PUBLIC_API_BASE_URL);

export function proxy(request: NextRequest) {
  const contentSecurityPolicy = buildContentSecurityPolicy({
    nonce: generateNonce(),
    isDev: process.env.NODE_ENV === "development",
    // Only when the public origin really is HTTPS (nginx sets X-Forwarded-Proto):
    // on a plain-HTTP deployment this directive would break every subresource.
    upgradeInsecureRequests: request.headers.get("x-forwarded-proto") === "https",
    connectSources: API_ORIGIN ? [API_ORIGIN] : [],
  });

  // next-intl copies the incoming request headers onto the request it forwards, so
  // setting these on a cloned request propagates them through the locale rewrite.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", request.nextUrl.pathname);
  requestHeaders.set("content-security-policy", contentSecurityPolicy);

  const response = handleI18nRouting(new NextRequest(request, { headers: requestHeaders }));
  response.headers.set("content-security-policy", contentSecurityPolicy);
  return response;
}

export const config = {
  // App routes only — skip Next internals, API routes, and any file with an extension.
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
