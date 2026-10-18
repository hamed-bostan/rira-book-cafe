import { getAppUrl } from "./appUrl";

/**
 * The public site's origin as a `URL` — the base for canonical links, Open Graph
 * URLs, the sitemap and robots.txt. `NEXT_PUBLIC_SITE_URL` wins when set (the
 * canonical host search engines should index); otherwise it is the same origin
 * `getAppUrl` resolves (`APP_URL`, else the incoming request behind nginx).
 *
 * Server-only by construction (`getAppUrl` imports `next/headers`).
 */
export async function getSiteUrl(): Promise<URL> {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  return new URL(configured ? configured : await getAppUrl());
}
