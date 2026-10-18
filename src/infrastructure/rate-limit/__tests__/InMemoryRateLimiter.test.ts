import { describe, expect, it } from "vitest";

import { InMemoryRateLimiter } from "../InMemoryRateLimiter";

/** A limiter on a hand-driven clock. */
function limiterAt(start = 1_000_000) {
  const clock = { now: start };
  const limiter = new InMemoryRateLimiter({ now: () => clock.now });
  return { clock, limiter };
}

const RULE = { limit: 3, windowMs: 60_000 };

describe("InMemoryRateLimiter", () => {
  it("allows up to the limit, then denies with the time until a slot frees", async () => {
    const { clock, limiter } = limiterAt();

    expect(await limiter.consume("k", RULE)).toEqual({ allowed: true, remaining: 2, retryAfterMs: 0 });
    clock.now += 10_000;
    expect((await limiter.consume("k", RULE)).remaining).toBe(1);
    clock.now += 10_000;
    expect((await limiter.consume("k", RULE)).remaining).toBe(0);

    clock.now += 5_000;
    // Oldest hit was 25s ago; it leaves the 60s window in 35s.
    expect(await limiter.consume("k", RULE)).toEqual({ allowed: false, remaining: 0, retryAfterMs: 35_000 });
  });

  it("slides: a slot frees exactly when the oldest hit ages out", async () => {
    const { clock, limiter } = limiterAt();
    for (let i = 0; i < 3; i += 1) await limiter.consume("k", RULE);

    clock.now += 59_999;
    expect((await limiter.consume("k", RULE)).allowed).toBe(false);
    clock.now += 1;
    expect((await limiter.consume("k", RULE)).allowed).toBe(true);
  });

  it("does not count denied hits, so hammering doesn't extend the lockout", async () => {
    const { clock, limiter } = limiterAt();
    for (let i = 0; i < 3; i += 1) await limiter.consume("k", RULE);
    for (let i = 0; i < 50; i += 1) await limiter.consume("k", RULE);

    clock.now += 60_000;
    expect(await limiter.consume("k", RULE)).toMatchObject({ allowed: true, remaining: 2 });
  });

  it("keeps keys independent", async () => {
    const { limiter } = limiterAt();
    for (let i = 0; i < 3; i += 1) await limiter.consume("a", RULE);

    expect((await limiter.consume("a", RULE)).allowed).toBe(false);
    expect((await limiter.consume("b", RULE)).allowed).toBe(true);
  });

  it("sweeps idle keys and caps how many it tracks", async () => {
    const clock = { now: 0 };
    const limiter = new InMemoryRateLimiter({ now: () => clock.now, maxKeys: 10, sweepEvery: 5 });

    for (let i = 0; i < 25; i += 1) await limiter.consume(`ip-${i}`, RULE);
    expect(limiter.size).toBeLessThanOrEqual(10);

    clock.now += 120_000;
    for (let i = 0; i < 5; i += 1) await limiter.consume("fresh", RULE);
    expect(limiter.size).toBe(1);
  });

  it("forgets every count on clear()", async () => {
    const limiter = new InMemoryRateLimiter({ now: () => 0 });
    for (let i = 0; i < RULE.limit; i += 1) await limiter.consume("a", RULE);
    expect((await limiter.consume("a", RULE)).allowed).toBe(false);

    limiter.clear();

    expect(limiter.size).toBe(0);
    expect((await limiter.consume("a", RULE)).allowed).toBe(true);
  });
});
