import { NextRequest, NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";

import { routing } from "@/src/i18n/routing";
import { errorResponse } from "@/src/lib/api/responses";
import { buildContentSecurityPolicy, generateNonce, originOf } from "@/src/lib/security/content-security-policy";
import { isCrossSiteMutation } from "@/src/lib/security/csrf";

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
 * 4. API requests (`/api/*`) only get a CSRF check: a state-changing call
 *    (POST/PUT/PATCH/DELETE) must come from this site's own pages, judged by
 *    `Sec-Fetch-Site` / `Origin` (see `src/lib/security/csrf.ts`). Done once here so
 *    no route handler can forget it. Server Actions need nothing extra — Next.js
 *    already refuses an action whose Origin doesn't match the host.
 *
 * Auth is NOT enforced here — protected routes guard themselves server-side via
 * `requireAuth()` / `requirePermission()`.
 */
const handleI18nRouting = createMiddleware(routing);

const API_ORIGIN = originOf(process.env.NEXT_PUBLIC_API_BASE_URL);
const APP_ORIGIN = originOf(process.env.APP_URL);

export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/api/")) return guardApi(request);

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

/** Refuse a cross-site state-changing API call (403); pass everything else through untouched. */
function guardApi(request: NextRequest): NextResponse {
  const crossSite = isCrossSiteMutation({
    method: request.method,
    secFetchSite: request.headers.get("sec-fetch-site"),
    origin: request.headers.get("origin"),
    host: request.headers.get("x-forwarded-host") ?? request.headers.get("host"),
    trustedOrigins: APP_ORIGIN ? [APP_ORIGIN] : [],
  });
  if (crossSite) {
    return errorResponse(403, { message: "Cross-site requests are not allowed.", code: "CSRF" });
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    // App routes — skip Next internals, API routes, and any file with an extension.
    "/((?!api|_next|_vercel|.*\\..*).*)",
    // API routes, for the CSRF check only.
    "/api/:path*",
  ],
};
