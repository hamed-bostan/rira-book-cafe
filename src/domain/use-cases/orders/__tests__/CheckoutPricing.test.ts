import { describe, expect, it, vi } from "vitest";

import { ConflictError } from "../../../errors/ConflictError";
import { CheckoutPricing } from "../CheckoutPricing";

import type { LoyaltySettings } from "../../../entities/Loyalty";
import type { PromoCode, PromoUsage } from "../../../entities/Promotion";

const NOW = new Date("2026-10-20T10:00:00Z");
const SETTINGS: LoyaltySettings = { enabled: true, tomanPerPoint: 10_000, pointValue: 1_000, minRedeemPoints: 50 };

const PROMO: PromoCode = {
  id: "promo1",
  code: "BOOKCLUB",
  kind: "percent",
  value: 20,
  minSubtotal: 0,
  isActive: true,
  createdAt: NOW.toISOString(),
  updatedAt: NOW.toISOString(),
};

type PricingSetup = {
  promo?: PromoCode | null;
  usage?: PromoUsage;
  balance?: number;
  settings?: LoyaltySettings;
};

function pricing({
  promo = PROMO,
  usage = { total: 0, byGuest: 0 },
  balance = 0,
  settings = SETTINGS,
}: PricingSetup = {}) {
  const promoRepo = {
    getByCode: vi.fn(async (code: string) => (code === promo?.code ? promo : null)),
    usage: vi.fn(async () => usage),
  };
  const loyaltyRepo = { getSettings: vi.fn(async () => settings), balance: vi.fn(async () => balance) };
  return new CheckoutPricing(promoRepo, loyaltyRepo);
}

describe("CheckoutPricing", () => {
  it("costs the subtotal with no discounts, and says what it would earn", async () => {
    const quote = await pricing({ balance: 10 }).execute({ subtotal: 300_000 }, "g1", NOW);
    expect(quote).toMatchObject({
      total: 300_000,
      promoDiscount: 0,
      pointsRedeemed: 0,
      pointsToEarn: 30,
      pointsBalance: 10,
    });
  });

  it("applies the code first, then points on what's left", async () => {
    const quote = await pricing({ balance: 500 }).execute(
      { subtotal: 300_000, promoCode: " bookclub ", redeemPoints: true },
      "g1",
      NOW,
    );
    expect(quote.promoCode).toBe("BOOKCLUB");
    expect(quote.promo).toEqual({ id: "promo1", code: "BOOKCLUB" });
    expect(quote.promoDiscount).toBe(60_000);
    // 240,000 left → at most 240 points.
    expect(quote.pointsRedeemed).toBe(240);
    expect(quote.pointsDiscount).toBe(240_000);
    expect(quote.total).toBe(0);
    expect(quote.pointsToEarn).toBe(0);
  });

  it("refuses a code that doesn't exist or can't be used, with the reason", async () => {
    await expect(pricing().execute({ subtotal: 100_000, promoCode: "NOPE" }, "g1", NOW)).rejects.toMatchObject({
      code: "PROMO_INVALID",
    });
    await expect(
      pricing({ usage: { total: 0, byGuest: 1 }, promo: { ...PROMO, perGuestLimit: 1 } }).execute(
        { subtotal: 100_000, promoCode: "BOOKCLUB" },
        "g1",
        NOW,
      ),
    ).rejects.toMatchObject({ code: "PROMO_USED_UP" });
  });

  it("refuses to spend points the guest can't use", async () => {
    await expect(
      pricing({ balance: 10 }).execute({ subtotal: 100_000, redeemPoints: true }, "g1", NOW),
    ).rejects.toBeInstanceOf(ConflictError);
    await expect(
      pricing({ balance: 500, settings: { ...SETTINGS, enabled: false } }).execute(
        { subtotal: 100_000, redeemPoints: true },
        "g1",
        NOW,
      ),
    ).rejects.toMatchObject({ code: "LOYALTY_DISABLED" });
  });

  it("without repositories, an order simply costs its subtotal", async () => {
    const quote = await new CheckoutPricing().execute({ subtotal: 90_000 }, "g1", NOW);
    expect(quote).toMatchObject({ total: 90_000, loyaltyEnabled: false, pointsToEarn: 0 });
  });
});

describe("CheckoutPricing.reprice", () => {
  /** An order placed with BOOKCLUB (20% off) and 100 points. */
  const PLACED = {
    userId: "g1",
    promoCodeId: "promo1",
    promoCode: "BOOKCLUB",
    pointsRedeemed: 100,
    pointsDiscount: 100_000,
  };
  const NO_PROMO = { ...PLACED, promoCodeId: undefined, promoCode: undefined };

  it("takes the order's code off the new subtotal, then the points it already spent", async () => {
    // The order's own use is counted: one in all, one by the guest.
    const repriced = await pricing({ usage: { total: 1, byGuest: 1 } }).reprice(PLACED, 400_000, NOW);
    expect(repriced).toEqual({
      subtotal: 400_000,
      promoDiscount: 80_000,
      pointsRedeemed: 100,
      pointsDiscount: 100_000,
      total: 220_000,
    });
  });

  it("doesn't count the order's own use against the code's limits", async () => {
    const limited = { ...PROMO, usageLimit: 1, perGuestLimit: 1 };
    await expect(
      pricing({ promo: limited, usage: { total: 1, byGuest: 1 } }).reprice(PLACED, 400_000, NOW),
    ).resolves.toMatchObject({ promoDiscount: 80_000 });
  });

  it("refuses when the code no longer applies: under its minimum, ended, switched off or gone", async () => {
    const usage = { total: 1, byGuest: 1 };
    const cases: Partial<PromoCode>[] = [
      { minSubtotal: 500_000 },
      { endsAt: "2026-10-01T00:00:00Z" },
      { isActive: false },
      { id: "another-code-with-the-same-word" },
    ];
    for (const change of cases) {
      await expect(
        pricing({ promo: { ...PROMO, ...change }, usage }).reprice(PLACED, 400_000, NOW),
      ).rejects.toMatchObject({ code: "PROMO_NO_LONGER_APPLIES" });
    }
    await expect(pricing({ promo: null, usage }).reprice(PLACED, 400_000, NOW)).rejects.toMatchObject({
      code: "PROMO_NO_LONGER_APPLIES",
    });
  });

  it("refuses when the points spent are worth more than what's left", async () => {
    await expect(pricing().reprice(NO_PROMO, 100_000, NOW)).resolves.toMatchObject({ total: 0 });
    await expect(pricing().reprice(NO_PROMO, 99_000, NOW)).rejects.toMatchObject({ code: "POINTS_EXCEED_TOTAL" });
  });

  it("never spends more of the guest's points on a bigger order", async () => {
    const repriced = await pricing({ balance: 5_000 }).reprice(NO_PROMO, 900_000, NOW);
    expect(repriced).toMatchObject({ pointsRedeemed: 100, pointsDiscount: 100_000, total: 800_000 });
  });
});
