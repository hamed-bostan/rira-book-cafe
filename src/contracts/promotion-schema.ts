import { z } from "zod";

import { cafeDayRange, isCafeDay } from "@/src/domain/entities/CafeTime";
import { MAX_LOYALTY_NOTE_LENGTH, MAX_POINTS_ADJUSTMENT } from "@/src/domain/entities/Loyalty";
import { isPlausiblePhone } from "@/src/domain/entities/Phone";
import {
  MAX_PROMO_DESCRIPTION_LENGTH,
  PROMO_CODE_PATTERN,
  PROMO_KINDS,
  normalizePromoCode,
} from "@/src/domain/entities/Promotion";

/**
 * Promotion and loyalty contracts shared by the dashboard forms and the route
 * handlers. The forms author strings (what their inputs emit); the schemas'
 * output is the domain shape, with the validity window as UTC instants. Messages
 * are `formErrors` keys.
 */

/** A whole number of Toman (or points) from a text input; blank → `undefined`. */
const optionalWhole = (message: string) =>
  z
    .string()
    .trim()
    .refine((value) => value === "" || /^\d+$/.test(value), message)
    .transform((value) => (value === "" ? undefined : Number(value)));

const optionalDay = z
  .string()
  .trim()
  .refine((value) => value === "" || isCafeDay(value), "dateInvalid")
  .transform((value) => (value === "" ? undefined : value));

export const promoCodeFormSchema = z
  .object({
    code: z
      .string()
      .transform(normalizePromoCode)
      .refine((value) => PROMO_CODE_PATTERN.test(value), "promoCodeInvalid"),
    description: z
      .string()
      .trim()
      .max(MAX_PROMO_DESCRIPTION_LENGTH, "descriptionTooLong")
      .transform((value) => (value ? value : undefined)),
    kind: z.enum(PROMO_KINDS, { message: "kindInvalid" }),
    value: z
      .string()
      .trim()
      .refine((value) => /^\d+$/.test(value) && Number(value) > 0, "promoValueInvalid")
      .transform(Number),
    maxDiscount: optionalWhole("amountInvalid"),
    minSubtotal: optionalWhole("amountInvalid").transform((value) => value ?? 0),
    /** Cafe days, inclusive; blank = open-ended. */
    startsOn: optionalDay,
    endsOn: optionalDay,
    usageLimit: optionalWhole("limitInvalid"),
    perGuestLimit: optionalWhole("limitInvalid"),
    isActive: z.boolean(),
  })
  .refine((data) => data.kind !== "percent" || data.value <= 100, { path: ["value"], message: "percentTooHigh" })
  .refine((data) => !data.startsOn || !data.endsOn || data.endsOn >= data.startsOn, {
    path: ["endsOn"],
    message: "endBeforeStart",
  })
  .refine((data) => data.usageLimit === undefined || data.usageLimit > 0, {
    path: ["usageLimit"],
    message: "limitInvalid",
  })
  .refine((data) => data.perGuestLimit === undefined || data.perGuestLimit > 0, {
    path: ["perGuestLimit"],
    message: "limitInvalid",
  })
  .refine((data) => data.maxDiscount === undefined || data.maxDiscount > 0, {
    path: ["maxDiscount"],
    message: "amountInvalid",
  })
  .transform(({ startsOn, endsOn, maxDiscount, ...rest }) => ({
    ...rest,
    // A cap only means something on a percentage.
    maxDiscount: rest.kind === "percent" ? maxDiscount : undefined,
    startsAt: startsOn ? cafeDayRange(startsOn).from.toISOString() : undefined,
    endsAt: endsOn ? cafeDayRange(endsOn).to.toISOString() : undefined,
  }));

export type PromoCodeFormInput = z.input<typeof promoCodeFormSchema>;
export type PromoCodeFormOutput = z.output<typeof promoCodeFormSchema>;

/** Switching a code on or off from the list. */
export const promoCodeActiveSchema = z.object({ isActive: z.boolean() });
export type PromoCodeActiveInput = z.input<typeof promoCodeActiveSchema>;

export const loyaltySettingsSchema = z.object({
  enabled: z.boolean(),
  tomanPerPoint: z.number().int("amountInvalid").min(1, "amountInvalid"),
  pointValue: z.number().int("amountInvalid").min(1, "amountInvalid"),
  minRedeemPoints: z.number().int("limitInvalid").min(0, "limitInvalid"),
});
export type LoyaltySettingsInput = z.input<typeof loyaltySettingsSchema>;

/** Staff adding or taking away a guest's points by hand. */
export const pointsAdjustmentSchema = z.object({
  phone: z.string().trim().refine(isPlausiblePhone, "phoneInvalid"),
  delta: z
    .number()
    .int("pointsInvalid")
    .refine((value) => value !== 0 && Math.abs(value) <= MAX_POINTS_ADJUSTMENT, "pointsInvalid"),
  note: z.string().trim().min(1, "noteRequired").max(MAX_LOYALTY_NOTE_LENGTH, "noteTooLong"),
});
export type PointsAdjustmentInput = z.input<typeof pointsAdjustmentSchema>;
