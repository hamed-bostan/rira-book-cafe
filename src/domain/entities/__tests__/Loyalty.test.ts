import { describe, expect, it } from "vitest";

import { DEFAULT_LOYALTY_SETTINGS, pointsEarnedFor, redeemablePoints, type LoyaltySettings } from "../Loyalty";

const SETTINGS: LoyaltySettings = { enabled: true, tomanPerPoint: 10_000, pointValue: 1_000, minRedeemPoints: 50 };

describe("pointsEarnedFor", () => {
  it("earns a whole point per step paid", () => {
    expect(pointsEarnedFor(259_000, SETTINGS)).toBe(25);
  });

  it("earns nothing while the club is off, or on a free order", () => {
    expect(pointsEarnedFor(259_000, { ...SETTINGS, enabled: false })).toBe(0);
    expect(pointsEarnedFor(0, SETTINGS)).toBe(0);
  });
});

describe("redeemablePoints", () => {
  it("spends the whole balance when the order is worth more", () => {
    expect(redeemablePoints(120, 500_000, SETTINGS)).toBe(120);
  });

  it("spends no more than the order is worth, in whole points", () => {
    expect(redeemablePoints(500, 75_500, SETTINGS)).toBe(75);
  });

  it("spends nothing below the minimum, or with the club off", () => {
    expect(redeemablePoints(49, 500_000, SETTINGS)).toBe(0);
    expect(redeemablePoints(500, 40_000, SETTINGS)).toBe(0);
    expect(redeemablePoints(500, 500_000, { ...SETTINGS, enabled: false })).toBe(0);
  });

  it("ships sensible defaults", () => {
    expect(DEFAULT_LOYALTY_SETTINGS.tomanPerPoint).toBeGreaterThan(0);
    expect(DEFAULT_LOYALTY_SETTINGS.pointValue).toBeGreaterThan(0);
  });
});
