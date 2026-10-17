import { withSentryConfig } from "@sentry/nextjs/config";
import createNextIntlPlugin from "next-intl/plugin";

import type { NextConfig } from "next";

// Points next-intl at the per-request config (locale resolution + message loading).
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// Images are self-hosted: uploads are served by this app from `/uploads`
// (see `app/uploads/[...path]/route.ts`), so next/image needs no remote hosts.
const nextConfig: NextConfig = {};

// Error tracking (Sentry SDK; works against Sentry SaaS or a self-hosted GlitchTip).
// Runtime init lives in `instrumentation.ts` / `instrumentation-client.ts`; this
// wrapper only handles build-time concerns. Source maps are uploaded only when
// `SENTRY_AUTH_TOKEN` is set at build time — otherwise the build never talks to
// the tracker and needs no Sentry config at all.
const uploadSourceMaps = Boolean(process.env.SENTRY_AUTH_TOKEN);

export default withSentryConfig(withNextIntl(nextConfig), {
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
