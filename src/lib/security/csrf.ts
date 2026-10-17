/**
 * Cross-site request forgery check for the REST API — defence in depth on top of
 * the session cookie's `SameSite=Lax` (which already keeps it off cross-site
 * POSTs in current browsers, but not off *same-site* ones: on this shared VPS a
 * neighbouring app on another port of the same host is "same-site").
 *
 * A state-changing request is accepted only when the browser vouches that it came
 * from this origin:
 * - `Sec-Fetch-Site` (all current browsers) must be `same-origin` — or `none`, a
 *   user-initiated navigation that no page could have forged;
 * - otherwise the `Origin` header's host must equal the request's host.
 * A request carrying neither header isn't from a browser page, so it carries no
 * ambient cookies to abuse and is let through (curl, server-to-server calls).
 *
 * Pure (no framework imports) so it can be unit-tested; `proxy.ts` applies it.
 */
const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export type CsrfCheckInput = {
  method: string;
  /** The `Sec-Fetch-Site` request header. */
  secFetchSite: string | null;
  /** The `Origin` request header. */
  origin: string | null;
  /** The host the request was addressed to (`X-Forwarded-Host`, else `Host`), port included. */
  host: string | null;
  /** Extra origins allowed to call the API (e.g. the configured public `APP_URL`). */
  trustedOrigins?: readonly string[];
};

/** True when a state-changing request did not come from this site's own pages. */
export function isCrossSiteMutation(input: CsrfCheckInput): boolean {
  if (!MUTATING_METHODS.has(input.method.toUpperCase())) return false;

  const origin = input.origin?.trim() || null;
  if (origin && origin !== "null" && input.trustedOrigins?.includes(origin)) return false;

  const site = input.secFetchSite?.trim().toLowerCase();
  if (site) return site !== "same-origin" && site !== "none";

  if (!origin) return false;
  if (origin === "null") return true; // Opaque origin: sandboxed frame, data: URL, …
  const host = input.host?.trim().toLowerCase();
  return !host || hostOf(origin) !== host;
}

/** `host[:port]` of an origin, lower-cased; null when it doesn't parse. */
function hostOf(origin: string): string | null {
  try {
    return new URL(origin).host.toLowerCase();
  } catch {
    return null;
  }
}
