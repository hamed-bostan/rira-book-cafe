/** At most `limit` hits per key within any rolling `windowMs`. */
export type RateLimitRule = {
  limit: number;
  windowMs: number;
};

/** The outcome of one attempt against a rule. */
export type RateLimitDecision = {
  /** Whether this hit was within the limit (and was counted). */
  allowed: boolean;
  /** Hits left in the current window after this one. */
  remaining: number;
  /** When denied, how long until the oldest counted hit leaves the window; 0 when allowed. */
  retryAfterMs: number;
};

/**
 * Counts hits per key (e.g. `otp-verify:ip:203.0.113.7`) against a rule. Async so
 * the in-process implementation can be swapped for a shared store (Redis) once the
 * app runs on more than one instance, without touching any caller.
 */
export type IRateLimiter = {
  /** Record a hit for `key` if it fits under `rule`; a denied hit is not counted. */
  consume(key: string, rule: RateLimitRule): Promise<RateLimitDecision>;
};
