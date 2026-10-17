import { describe, expect, it } from "vitest";

import { normalizePromoCode, promoDiscount, promoProblem, type PromoCode } from "../Promotion";

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
