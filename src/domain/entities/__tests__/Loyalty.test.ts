import { describe, expect, it } from "vitest";

import {
  addMonths,
  DEFAULT_LOYALTY_SETTINGS,
  isLoyaltyActivity,
  pointsEarnedFor,
  pointsExpireAt,
  redeemablePoints,
  type LoyaltySettings,
} from "../Loyalty";

const SETTINGS: LoyaltySettings = {
  enabled: true,
  tomanPerPoint: 10_000,
  pointValue: 1_000,
  minRedeemPoints: 50,
  pointsExpiryMonths: 0,
};

describe("points expiry", () => {
  const EXPIRING: LoyaltySettings = {
    ...SETTINGS,
    pointsExpiryMonths: 12,
    pointsExpirySince: "2026-01-01T00:00:00.000Z",
  };

  it("is off by default: points never lapse", () => {
    expect(DEFAULT_LOYALTY_SETTINGS.pointsExpiryMonths).toBe(0);
    expect(pointsExpireAt("2020-01-01T00:00:00.000Z", SETTINGS)).toBeNull();
  });

  it("lapses the balance the set months after the last activity", () => {
    expect(pointsExpireAt("2026-03-15T08:00:00.000Z", EXPIRING)?.toISOString()).toBe("2027-03-15T08:00:00.000Z");
  });

  it("counts from the day expiry was switched on when the last activity was before it", () => {
    expect(pointsExpireAt("2024-05-01T00:00:00.000Z", EXPIRING)?.toISOString()).toBe("2027-01-01T00:00:00.000Z");
  });

  it("doesn't lapse while the club is off, or for a guest never active", () => {
    expect(pointsExpireAt("2026-03-15T08:00:00.000Z", { ...EXPIRING, enabled: false })).toBeNull();
    expect(pointsExpireAt(undefined, EXPIRING)).toBeNull();
  });

  it("adds calendar months, clamping to the month's last day", () => {
    expect(addMonths(new Date("2026-01-31T10:00:00Z"), 1).toISOString()).toBe("2026-02-28T10:00:00.000Z");
    expect(addMonths(new Date("2026-03-31T10:00:00Z"), -1).toISOString()).toBe("2026-02-28T10:00:00.000Z");
    expect(addMonths(new Date("2026-11-15T00:00:00Z"), 3).toISOString()).toBe("2027-02-15T00:00:00.000Z");
  });

  it("counts earning, spending, points back and points given as activity — not takings or the expiry", () => {
    expect(isLoyaltyActivity({ reason: "earn", delta: 10 })).toBe(true);
    expect(isLoyaltyActivity({ reason: "redeem", delta: -50 })).toBe(true);
    expect(isLoyaltyActivity({ reason: "refund", delta: 50 })).toBe(true);
    expect(isLoyaltyActivity({ reason: "adjust", delta: 20 })).toBe(true);
    expect(isLoyaltyActivity({ reason: "adjust", delta: -20 })).toBe(false);
    expect(isLoyaltyActivity({ reason: "expire", delta: -70 })).toBe(false);
  });
});

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
