const registry = globalThis as typeof globalThis & {
  __otpStores?: Map<string, Map<string, unknown>>;
};

/**
 * Returns a named `Map` that survives module re-evaluation within a single Node
 * process by anchoring it to `globalThis`.
 *
 * Why: an OTP is requested on one request (`/login`) and verified on a later one
 * (`/login/verify`). A plain module/instance-level `Map` is reset when Next.js
 * re-evaluates server modules between requests in dev (and on HMR), so the
 * stored code "disappears" and the first verify fails until a resend happens on
 * the same request. Pinning the store to `globalThis` keeps it stable.
 *
 * Still single-process only — for multi-instance/serverless, back this with a
 * shared store (Redis/DB) instead.
 */
export function getOtpStore<V>(name: string): Map<string, V> {
  const stores = (registry.__otpStores ??= new Map<string, Map<string, unknown>>());

  const existing = stores.get(name);
  if (existing) {
    return existing as Map<string, V>;
  }

  const created = new Map<string, V>();
  stores.set(name, created);
  return created;
}
