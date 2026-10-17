/**
 * The caller's IP address, as seen by the outermost proxy we trust.
 *
 * Behind the host nginx, `X-Forwarded-For` arrives as `<whatever the client sent>,
 * <address nginx saw>` (`$proxy_add_x_forwarded_for` appends). Everything left of
 * the trusted hops is client-controlled and spoofable, so the address is read from
 * the right: with one trusted proxy, the last entry. Without a proxy, Next.js fills
 * the header from the socket, which is the same single-entry case.
 *
 * Pure (takes a `Headers`) so route handlers and server actions share it.
 */
export function clientIp(headers: Headers, trustedProxyHops = 1): string {
  const forwarded = (headers.get("x-forwarded-for") ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  const hops = Math.max(1, trustedProxyHops);
  if (forwarded.length >= hops) return forwarded[forwarded.length - hops];

  return headers.get("x-real-ip")?.trim() || "unknown";
}
