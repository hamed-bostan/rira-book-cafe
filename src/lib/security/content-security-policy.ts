/**
 * The Content-Security-Policy for HTML pages. Pure (no framework imports) so it can
 * be unit-tested and shared by the proxy, which generates a fresh nonce per request.
 *
 * Scripts: nonce + `'strict-dynamic'` — Next.js reads the nonce back out of the
 * request's CSP header during dynamic rendering and stamps it onto every framework
 * script and inline RSC payload; chunks those scripts load inherit trust through
 * `'strict-dynamic'`. No `'unsafe-inline'`, so an injected `<script>` never runs.
 *
 * Styles: `'unsafe-inline'` without a nonce, on purpose. Radix, Recharts and
 * React itself render inline `style="…"` attributes, which a nonce cannot cover
 * (a nonce in `style-src` would also switch `'unsafe-inline'` off). Style injection
 * is a far weaker vector than script injection, and scripts stay locked down.
 *
 * Images: `'self'` covers `/uploads` (self-hosted) and `/_next/image`; `data:` and
 * `blob:` cover placeholders and local previews of a picked file before upload.
 */
export type ContentSecurityPolicyOptions = {
  /** Per-request random nonce (base64). */
  nonce: string;
  /** Development needs `'unsafe-eval'` (React rebuilds server stacks with `eval`). */
  isDev: boolean;
  /** Add `upgrade-insecure-requests` — only when the site is actually served over HTTPS. */
  upgradeInsecureRequests: boolean;
  /** Extra origins the browser may call (e.g. an absolute `NEXT_PUBLIC_API_BASE_URL`). */
  connectSources?: readonly string[];
};

export function buildContentSecurityPolicy(options: ContentSecurityPolicyOptions): string {
  const directives: string[] = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${options.nonce}' 'strict-dynamic'${options.isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    ["connect-src 'self'", ...(options.connectSources ?? [])].join(" "),
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];
  if (options.upgradeInsecureRequests) directives.push("upgrade-insecure-requests");
  return directives.join("; ");
}

/** A random, unguessable nonce for one response. Web Crypto, so it runs anywhere. */
export function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

/** The origin of an absolute URL, or `null` for a relative one (already `'self'`). */
export function originOf(url: string | undefined): string | null {
  if (!url || url.startsWith("/")) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}
