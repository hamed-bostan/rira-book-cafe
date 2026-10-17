import createNextIntlPlugin from "next-intl/plugin";

import type { NextConfig } from "next";

// Points next-intl at the per-request config (locale resolution + message loading).
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// Images are self-hosted: uploads are served by this app from `/uploads`
// (see `app/uploads/[...path]/route.ts`), so next/image needs no remote hosts.
const nextConfig: NextConfig = {};

export default withNextIntl(nextConfig);
