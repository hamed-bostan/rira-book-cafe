import createNextIntlPlugin from "next-intl/plugin";

import type { NextConfig } from "next";

// Points next-intl at the per-request config (locale resolution + message loading).
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/**
 * Security headers for every response. Kept inline rather than imported from
 * `src/`: the Docker runner stage copies `next.config.ts` alone (no `src/`), and
 * `next start` loads this file at boot.
 *
 * The HTML pages' Content-Security-Policy is NOT here — it carries a per-request
 * nonce, so `proxy.ts` sets it. Endpoints that never render HTML get a lock-down
 * policy instead (below).
 */
const SECURITY_HEADERS = [
  // Browsers only honour HSTS over HTTPS, so this is inert on a plain-HTTP origin
  // and takes effect as soon as TLS is in front. No `preload`: that's a one-way
  // door to opt into deliberately (hstspreload.org).
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // The app uses none of these; deny them so an injected frame or script can't either.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
  },
  // Legacy twin of CSP `frame-ancestors 'none'` for browsers that predate it.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

/**
 * JSON endpoints and stored images never need to load anything. `sandbox` also
 * strips script execution and same-origin rights should a response ever be
 * rendered as a document (e.g. a crafted upload opened directly).
 */
const NON_DOCUMENT_CSP = { key: "Content-Security-Policy", value: "default-src 'none'; frame-ancestors 'none'; sandbox" };

// Images are self-hosted: uploads are served by this app from `/uploads`
// (see `app/uploads/[...path]/route.ts`), so next/image needs no remote hosts.
const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: SECURITY_HEADERS },
      { source: "/api/:path*", headers: [NON_DOCUMENT_CSP] },
      { source: "/uploads/:path*", headers: [NON_DOCUMENT_CSP] },
    ];
  },
};

export default withNextIntl(nextConfig);
