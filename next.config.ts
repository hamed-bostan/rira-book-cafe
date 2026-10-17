import createNextIntlPlugin from "next-intl/plugin";

import type { NextConfig } from "next";

// Points next-intl at the per-request config (locale resolution + message loading).
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// Bundle treemaps (`.next/analyze/*.html`) on demand: `ANALYZE=true` on a webpack
// build, or simply `npm run analyze` — keyed on the npm script name too, since
// `VAR=value cmd` doesn't work in the Windows shell npm uses. The plugin hooks
// webpack, so the script builds with `--webpack`; Turbopack builds (the default)
// can use `npx next experimental-analyze` instead.
const ANALYZE = process.env.ANALYZE === "true" || process.env.npm_lifecycle_event === "analyze";

// Images are self-hosted: uploads are served by this app from `/uploads`
// (see `app/uploads/[...path]/route.ts`), so next/image needs no remote hosts.
const nextConfig: NextConfig = {};

/**
 * The analyzer is a dev dependency, so it's only imported when asked for — `next
 * start` loads this file too and must not need it.
 */
export default async function loadNextConfig(): Promise<NextConfig> {
  const config = withNextIntl(nextConfig);
  if (!ANALYZE) return config;

  const { default: bundleAnalyzer } = await import("@next/bundle-analyzer");
  return bundleAnalyzer({ enabled: true })(config);
}
