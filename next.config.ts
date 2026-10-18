import { withSentryConfig } from "@sentry/nextjs/config";
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
const NON_DOCUMENT_CSP = {
  key: "Content-Security-Policy",
  value: "default-src 'none'; frame-ancestors 'none'; sandbox",
};

// Bundle treemaps (`.next/analyze/*.html`) on demand: `ANALYZE=true` on a webpack
// build, or simply `npm run analyze` — keyed on the npm script name too, since
// `VAR=value cmd` doesn't work in the Windows shell npm uses. The plugin hooks
// webpack, so the script builds with `--webpack`; Turbopack builds (the default)
// can use `npx next experimental-analyze` instead.
const ANALYZE = process.env.ANALYZE === "true" || process.env.npm_lifecycle_event === "analyze";

// Images are self-hosted: uploads are served by this app from `/uploads`
// (see `app/uploads/[...path]/route.ts`), so next/image needs no remote hosts.
const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: SECURITY_HEADERS },
      { source: "/api/:path*", headers: [NON_DOCUMENT_CSP] },
      { source: "/uploads/:path*", headers: [NON_DOCUMENT_CSP] },
      // Self-hosted fonts carry a content hash in their name (src/styles/fonts.css),
      // so a changed file gets a new URL and the old one can be cached forever.
      { source: "/fonts/:file*", headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }] },
    ];
  },
};

// Error tracking (Sentry SDK; works against Sentry SaaS or a self-hosted GlitchTip).
// Runtime init lives in `instrumentation.ts` / `instrumentation-client.ts`; this
// wrapper only handles build-time concerns. Source maps are uploaded only when
// `SENTRY_AUTH_TOKEN` is set at build time — otherwise the build never talks to
// the tracker and needs no Sentry config at all.
const uploadSourceMaps = Boolean(process.env.SENTRY_AUTH_TOKEN);

const config = withSentryConfig(withNextIntl(nextConfig), {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  // Self-hosted tracker (GlitchTip / self-hosted Sentry); defaults to sentry.io.
  sentryUrl: process.env.SENTRY_URL,
  sourcemaps: { disable: !uploadSourceMaps },
  release: { name: process.env.SENTRY_RELEASE, create: uploadSourceMaps, finalize: uploadSourceMaps },
  telemetry: false,
  silent: !process.env.CI,
});

/**
 * The analyzer is a dev dependency, so it's only imported when asked for — `next
 * start` loads this file too and must not need it.
 */
export default async function loadNextConfig(): Promise<NextConfig> {
  if (!ANALYZE) return config;

  const { default: bundleAnalyzer } = await import("@next/bundle-analyzer");
  return bundleAnalyzer({ enabled: true })(config);
}
