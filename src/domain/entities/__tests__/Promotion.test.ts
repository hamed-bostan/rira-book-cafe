import { describe, expect, it } from "vitest";

import {
  isPromoCodeFinished,
  normalizePromoCode,
  PROMO_CODE_STATES,
  promoCodeState,
  promoDiscount,
  promoProblem,
  type PromoCode,
  type PromoCodeWithUses,
} from "../Promotion";

const NOW = new Date("2026-10-20T10:00:00Z");

function promo(overrides: Partial<PromoCode> = {}): PromoCode {
  return {
    id: "p1",
    code: "WELCOME10",
    kind: "percent",
    value: 10,
    minSubtotal: 0,
    isActive: true,
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...overrides,
  };
}

const UNUSED = { total: 0, byGuest: 0 };

describe("promoDiscount", () => {
  it("takes a percentage off, rounded down to whole Toman", () => {
    expect(promoDiscount(promo({ value: 10 }), 155_555)).toBe(15_555);
  });

  it("caps a percentage at its maximum", () => {
    expect(promoDiscount(promo({ value: 50, maxDiscount: 100_000 }), 500_000)).toBe(100_000);
  });

  it("never takes more than the order is worth", () => {
    expect(promoDiscount(promo({ kind: "fixed", value: 200_000 }), 150_000)).toBe(150_000);
    expect(promoDiscount(promo({ kind: "fixed", value: 200_000 }), 0)).toBe(0);
  });
});

describe("promoProblem", () => {
  it("accepts a live code", () => {
    expect(promoProblem(promo(), 100_000, UNUSED, NOW)).toBeNull();
  });

  it("refuses a switched-off code, and one outside its window", () => {
    expect(promoProblem(promo({ isActive: false }), 100_000, UNUSED, NOW)).toBe("PROMO_INVALID");
    expect(promoProblem(promo({ startsAt: "2026-10-21T00:00:00Z" }), 100_000, UNUSED, NOW)).toBe("PROMO_EXPIRED");
    expect(promoProblem(promo({ endsAt: "2026-10-20T10:00:00Z" }), 100_000, UNUSED, NOW)).toBe("PROMO_EXPIRED");
  });

  it("refuses a code used up in all or by this guest", () => {
    expect(promoProblem(promo({ usageLimit: 5 }), 100_000, { total: 5, byGuest: 0 }, NOW)).toBe("PROMO_USED_UP");
    expect(promoProblem(promo({ perGuestLimit: 1 }), 100_000, { total: 3, byGuest: 1 }, NOW)).toBe("PROMO_USED_UP");
    expect(promoProblem(promo({ usageLimit: 5, perGuestLimit: 2 }), 100_000, { total: 4, byGuest: 1 }, NOW)).toBeNull();
  });

  it("refuses an order under the minimum", () => {
    expect(promoProblem(promo({ minSubtotal: 200_000 }), 199_999, UNUSED, NOW)).toBe("PROMO_MIN_SUBTOTAL");
  });
});

describe("normalizePromoCode", () => {
  it("trims and upper-cases what the guest typed", () => {
    expect(normalizePromoCode("  welcome10 ")).toBe("WELCOME10");
  });
});

describe("promoCodeState", () => {
  const withUses = (overrides: Partial<PromoCode> = {}, uses = 0): PromoCodeWithUses => ({
    ...promo(overrides),
    uses,
  });

  it("is live when on, started, not ended and with uses left", () => {
    expect(promoCodeState(withUses({ startsAt: "2026-10-01T00:00:00Z", usageLimit: 5 }, 4), NOW)).toBe("live");
  });

  it("is off when switched off", () => {
    expect(promoCodeState(withUses({ isActive: false }), NOW)).toBe("off");
  });

  it("is scheduled when on but not started yet — and off wins over scheduled", () => {
    expect(promoCodeState(withUses({ startsAt: "2026-11-01T00:00:00Z" }), NOW)).toBe("scheduled");
    expect(promoCodeState(withUses({ startsAt: "2026-11-01T00:00:00Z", isActive: false }), NOW)).toBe("off");
  });

  it("is ended once its end has passed, switched on or not", () => {
    expect(promoCodeState(withUses({ endsAt: NOW.toISOString() }), NOW)).toBe("ended");
    expect(promoCodeState(withUses({ endsAt: "2026-10-01T00:00:00Z", isActive: false }), NOW)).toBe("ended");
  });

  it("is used up when every allowed use is taken, switched on or not", () => {
    expect(promoCodeState(withUses({ usageLimit: 3 }, 3), NOW)).toBe("usedUp");
    expect(promoCodeState(withUses({ usageLimit: 3, isActive: false }, 3), NOW)).toBe("usedUp");
  });

  it("calls only ended and used-up codes finished", () => {
    expect(PROMO_CODE_STATES.filter(isPromoCodeFinished)).toEqual(["ended", "usedUp"]);
  });
});
