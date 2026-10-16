import { headers } from "next/headers";

/**
 * The app's public origin (scheme + host, no trailing slash) — for links that
 * leave the app and must still work when clicked, e.g. the sign-in URL in an
 * admin invitation email.
 *
 * Mirrors how `server-client.ts` resolves its API base: an explicit `APP_URL`
 * wins, otherwise the origin is derived from the incoming request. Behind nginx
 * that means the `x-forwarded-*` headers, which carry the public host — the raw
 * `host` would be the container's internal name and produce a dead link.
 *
 * Server-only by construction (it imports `next/headers`).
 */
export async function getAppUrl(): Promise<string> {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");

  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  if (!host) throw new Error("Cannot resolve the app URL: the request has no host header.");

  const proto =
    requestHeaders.get("x-forwarded-proto") ??
    (process.env.NODE_ENV === "development" ? "http" : "https");
  return `${proto}://${host}`;
}
