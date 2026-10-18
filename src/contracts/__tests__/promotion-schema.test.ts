import { describe, expect, it } from "vitest";

import { MAX_LOYALTY_NOTE_LENGTH, MAX_POINTS_ADJUSTMENT } from "@/src/domain/entities/Loyalty";
import { MAX_PROMO_DESCRIPTION_LENGTH } from "@/src/domain/entities/Promotion";

import {
  loyaltySettingsSchema,
  pointsAdjustmentSchema,
  promoCodeActiveSchema,
  promoCodeFormSchema,
  type LoyaltySettingsInput,
  type PointsAdjustmentInput,
  type PromoCodeFormInput,
} from "../promotion-schema";

const PROMO: PromoCodeFormInput = {
  code: " summer-25 ",
  description: "",
  kind: "percent",
  value: "20",
  maxDiscount: "50000",
  minSubtotal: "",
  startsOn: "2026-10-20",
  endsOn: "2026-10-31",
  usageLimit: "",
  perGuestLimit: "1",
  isActive: true,
};

const promoErrors = (input: unknown): Record<string, string[] | undefined> | undefined =>
  promoCodeFormSchema.safeParse(input).error?.flatten().fieldErrors;

describe("promoCodeFormSchema", () => {
  it("normalizes the code and turns the cafe-day window into UTC instants", () => {
    expect(promoCodeFormSchema.parse(PROMO)).toEqual({
      code: "SUMMER-25",
      description: undefined,
      kind: "percent",
      value: 20,
      maxDiscount: 50000,
      minSubtotal: 0,
      usageLimit: undefined,
      perGuestLimit: 1,
      isActive: true,
      // Tehran is UTC+03:30: the window opens at local midnight and closes at the end of the last day.
      startsAt: "2026-10-19T20:30:00.000Z",
      endsAt: "2026-10-31T20:30:00.000Z",
    });
  });

  it("leaves an open-ended window and an absent cap undefined", () => {
    const parsed = promoCodeFormSchema.parse({ ...PROMO, startsOn: " ", endsOn: "", maxDiscount: "", minSubtotal: " 300000 ", usageLimit: "100" });
    expect(parsed).toMatchObject({ startsAt: undefined, endsAt: undefined, maxDiscount: undefined, minSubtotal: 300000, usageLimit: 100 });
    expect(parsed).not.toHaveProperty("startsOn");
    expect(parsed).not.toHaveProperty("endsOn");
  });

  it("drops the cap on a fixed-amount code and allows values above 100", () => {
    expect(promoCodeFormSchema.parse({ ...PROMO, kind: "fixed", value: "250000", description: " Autumn " })).toMatchObject({
      kind: "fixed",
      value: 250000,
      maxDiscount: undefined,
      description: "Autumn",
    });
  });

  it("refuses a malformed code", () => {
    for (const code of ["ab", "summer 25", "x".repeat(21), "50%off"]) {
      expect(promoErrors({ ...PROMO, code })?.code).toEqual(["promoCodeInvalid"]);
    }
  });

  it("maps each invalid field to its message key", () => {
    expect(
      promoErrors({
        ...PROMO,
        description: "d".repeat(MAX_PROMO_DESCRIPTION_LENGTH + 1),
        kind: "bogo",
        value: "0",
        maxDiscount: "x",
        minSubtotal: "-1",
        startsOn: "soon",
        usageLimit: "lots",
        perGuestLimit: "1.5",
      }),
    ).toEqual({
      description: ["descriptionTooLong"],
      kind: ["kindInvalid"],
      value: ["promoValueInvalid"],
      maxDiscount: ["amountInvalid"],
      minSubtotal: ["amountInvalid"],
      startsOn: ["dateInvalid"],
      usageLimit: ["limitInvalid"],
      perGuestLimit: ["limitInvalid"],
    });
    expect(promoErrors({ ...PROMO, value: "1.5" })?.value).toEqual(["promoValueInvalid"]);
  });

  it("caps a percentage at 100", () => {
    expect(promoCodeFormSchema.parse({ ...PROMO, value: "100" }).value).toBe(100);
    expect(promoErrors({ ...PROMO, value: "101" })?.value).toEqual(["percentTooHigh"]);
  });

  it("refuses a window that ends before it starts, but allows a single day", () => {
    expect(promoErrors({ ...PROMO, startsOn: "2026-10-31", endsOn: "2026-10-20" })?.endsOn).toEqual(["endBeforeStart"]);
    expect(promoCodeFormSchema.safeParse({ ...PROMO, startsOn: "2026-10-20", endsOn: "2026-10-20" }).success).toBe(true);
  });

  it("refuses zero limits and a zero cap", () => {
    expect(promoErrors({ ...PROMO, usageLimit: "0", perGuestLimit: "0", maxDiscount: "0" })).toEqual({
      usageLimit: ["limitInvalid"],
      perGuestLimit: ["limitInvalid"],
      maxDiscount: ["amountInvalid"],
    });
  });
});

describe("promoCodeActiveSchema", () => {
  it("only takes a boolean", () => {
    expect(promoCodeActiveSchema.parse({ isActive: true })).toEqual({ isActive: true });
    expect(promoCodeActiveSchema.safeParse({ isActive: 1 }).success).toBe(false);
  });
});

describe("loyaltySettingsSchema", () => {
  const SETTINGS: LoyaltySettingsInput = { enabled: true, tomanPerPoint: 10000, pointValue: 1000, minRedeemPoints: 0 };

  it("accepts whole positive rates and a zero redemption floor", () => {
    expect(loyaltySettingsSchema.parse(SETTINGS)).toEqual(SETTINGS);
  });

  it("maps each invalid field to its message key", () => {
    expect(loyaltySettingsSchema.safeParse({ ...SETTINGS, tomanPerPoint: 0, pointValue: 1.5, minRedeemPoints: -1 }).error?.flatten().fieldErrors).toEqual({
      tomanPerPoint: ["amountInvalid"],
      pointValue: ["amountInvalid"],
      minRedeemPoints: ["limitInvalid"],
    });
    expect(loyaltySettingsSchema.safeParse({ ...SETTINGS, minRedeemPoints: 2.5 }).error?.flatten().fieldErrors.minRedeemPoints).toEqual([
      "limitInvalid",
    ]);
  });
});

describe("pointsAdjustmentSchema", () => {
  const ADJUSTMENT: PointsAdjustmentInput = { phone: " 0912 345 6789 ", delta: -50, note: " Birthday gift " };

  it("trims the phone and the note", () => {
    expect(pointsAdjustmentSchema.parse(ADJUSTMENT)).toEqual({ phone: "0912 345 6789", delta: -50, note: "Birthday gift" });
  });

  it("accepts adjustments up to the cap either way", () => {
    expect(pointsAdjustmentSchema.safeParse({ ...ADJUSTMENT, delta: MAX_POINTS_ADJUSTMENT }).success).toBe(true);
    expect(pointsAdjustmentSchema.safeParse({ ...ADJUSTMENT, delta: -MAX_POINTS_ADJUSTMENT }).success).toBe(true);
  });

  it("refuses a zero, fractional or oversized delta", () => {
    for (const delta of [0, 1.5, MAX_POINTS_ADJUSTMENT + 1, -MAX_POINTS_ADJUSTMENT - 1]) {
      expect(pointsAdjustmentSchema.safeParse({ ...ADJUSTMENT, delta }).error?.flatten().fieldErrors.delta).toContain("pointsInvalid");
    }
  });

  it("maps a bad phone and note to their message keys", () => {
    expect(pointsAdjustmentSchema.safeParse({ ...ADJUSTMENT, phone: "12", note: " " }).error?.flatten().fieldErrors).toEqual({
      phone: ["phoneInvalid"],
      note: ["noteRequired"],
    });
    expect(pointsAdjustmentSchema.safeParse({ ...ADJUSTMENT, note: "n".repeat(MAX_LOYALTY_NOTE_LENGTH + 1) }).error?.flatten().fieldErrors.note).toEqual([
      "noteTooLong",
    ]);
  });
});
