import type { IRateLimiter, RateLimitDecision, RateLimitRule } from "@/src/domain/repositories/IRateLimiter";

type Bucket = {
  /** Timestamps (ms) of the counted hits still inside the window, oldest first. */
  hits: number[];
  /** The window this key was last checked against, for sweeping idle keys. */
  windowMs: number;
};

export type InMemoryRateLimiterOptions = {
  /** Clock, injectable for tests. */
  now?: () => number;
  /** Upper bound on tracked keys, so a flood of distinct keys can't exhaust memory. */
  maxKeys?: number;
  /** Sweep idle keys every this many hits. */
  sweepEvery?: number;
};

/**
 * Sliding-window-log rate limiter held in this process's memory. Exact (no fixed
 * window edges to burst across) and cheap at this app's scale: a key never holds
 * more than `limit` timestamps, because denied hits aren't recorded.
 *
 * Single-instance only — every app replica would count separately. Swap the
 * binding in `container.ts` for a shared-store implementation of `IRateLimiter`
 * before scaling out.
 */
export class InMemoryRateLimiter implements IRateLimiter {
  private readonly buckets = new Map<string, Bucket>();
  private readonly now: () => number;
  private readonly maxKeys: number;
  private readonly sweepEvery: number;
  private hitsSinceSweep = 0;

  constructor(options: InMemoryRateLimiterOptions = {}) {
    this.now = options.now ?? Date.now;
    this.maxKeys = options.maxKeys ?? 50_000;
    this.sweepEvery = options.sweepEvery ?? 1_000;
  }

  async consume(key: string, rule: RateLimitRule): Promise<RateLimitDecision> {
    const now = this.now();
    this.maybeSweep(now);

    const bucket = this.buckets.get(key) ?? { hits: [], windowMs: rule.windowMs };
    bucket.windowMs = rule.windowMs;
    const windowStart = now - rule.windowMs;
    while (bucket.hits.length > 0 && bucket.hits[0] <= windowStart) bucket.hits.shift();

    if (bucket.hits.length >= rule.limit) {
      this.buckets.set(key, bucket);
      return { allowed: false, remaining: 0, retryAfterMs: Math.max(1, bucket.hits[0] + rule.windowMs - now) };
    }

    bucket.hits.push(now);
    // Re-insert so Map order tracks recency — eviction below drops the stalest key.
    this.buckets.delete(key);
    this.buckets.set(key, bucket);
    return { allowed: true, remaining: rule.limit - bucket.hits.length, retryAfterMs: 0 };
  }

  /** Number of keys currently tracked (for tests and diagnostics). */
  get size(): number {
    return this.buckets.size;
  }

  /** Forget every count — for test suites that reset all state between tests. */
  clear(): void {
    this.buckets.clear();
    this.hitsSinceSweep = 0;
  }

  private maybeSweep(now: number): void {
    this.hitsSinceSweep += 1;
    if (this.hitsSinceSweep < this.sweepEvery && this.buckets.size < this.maxKeys) return;
    this.hitsSinceSweep = 0;

    for (const [key, bucket] of this.buckets) {
      const newest = bucket.hits.at(-1);
      if (newest === undefined || newest <= now - bucket.windowMs) this.buckets.delete(key);
    }
    // Still full of live keys: drop the least recently used ones.
    for (const key of this.buckets.keys()) {
      if (this.buckets.size < this.maxKeys) break;
      this.buckets.delete(key);
    }
  }
}
