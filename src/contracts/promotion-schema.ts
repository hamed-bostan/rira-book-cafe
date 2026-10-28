import { cafeDayRange, isCafeDay } from "@/src/domain/entities/CafeTime";
import { MAX_LOYALTY_NOTE_LENGTH, MAX_POINTS_ADJUSTMENT } from "@/src/domain/entities/Loyalty";
import { isPlausiblePhone } from "@/src/domain/entities/Phone";
import {
  MAX_PROMO_DESCRIPTION_LENGTH,
  PROMO_CODE_PATTERN,
  PROMO_KINDS,
  normalizePromoCode,
} from "@/src/domain/entities/Promotion";
import * as z from "@/src/lib/zod";

import { fieldsParsed } from "./fields-parsed";

/**
 * Promotion and loyalty contracts shared by the dashboard forms and the route
 * handlers. The forms author strings (what their inputs emit); the schemas'
 * output is the domain shape, with the validity window as UTC instants. Messages
 * are `formErrors` keys.
 */

/** A whole number of Toman (or points) from a text input; blank → `undefined`. */
const optionalWhole = (message: string) =>
  z.pipe(
    z.string().check(
      z.trim(),
      z.refine((value) => value === "" || /^\d+$/.test(value), message),
    ),
    z.transform((value) => (value === "" ? undefined : Number(value))),
  );

const optionalDay = z.pipe(
  z.string().check(
    z.trim(),
    z.refine((value) => value === "" || isCafeDay(value), "dateInvalid"),
  ),
  z.transform((value) => (value === "" ? undefined : value)),
);

const promoFieldsParsed = fieldsParsed(
  "description",
  "value",
  "maxDiscount",
  "minSubtotal",
  "startsOn",
  "endsOn",
  "usageLimit",
  "perGuestLimit",
);

export const promoCodeFormSchema = z.pipe(
  z
    .object({
      code: z
        .pipe(z.string(), z.transform(normalizePromoCode))
        .check(z.refine((value) => PROMO_CODE_PATTERN.test(value), "promoCodeInvalid")),
      description: z.pipe(
        z.string().check(z.trim(), z.maxLength(MAX_PROMO_DESCRIPTION_LENGTH, "descriptionTooLong")),
        z.transform((value) => (value ? value : undefined)),
      ),
      kind: z.enum(PROMO_KINDS, { error: "kindInvalid" }),
      value: z.pipe(
        z.string().check(
          z.trim(),
          z.refine((value) => /^\d+$/.test(value) && Number(value) > 0, "promoValueInvalid"),
        ),
        z.transform(Number),
      ),
      maxDiscount: optionalWhole("amountInvalid"),
      minSubtotal: z.pipe(
        optionalWhole("amountInvalid"),
        z.transform((value) => value ?? 0),
      ),
      /** Cafe days, inclusive; blank = open-ended. */
      startsOn: optionalDay,
      endsOn: optionalDay,
      usageLimit: optionalWhole("limitInvalid"),
      perGuestLimit: optionalWhole("limitInvalid"),
      isActive: z.boolean(),
    })
    .check(
      z.refine((data) => data.kind !== "percent" || data.value <= 100, {
        path: ["value"],
        error: "percentTooHigh",
        when: promoFieldsParsed,
      }),
      z.refine((data) => !data.startsOn || !data.endsOn || data.endsOn >= data.startsOn, {
        path: ["endsOn"],
        error: "endBeforeStart",
        when: promoFieldsParsed,
      }),
      z.refine((data) => data.usageLimit === undefined || data.usageLimit > 0, {
        path: ["usageLimit"],
        error: "limitInvalid",
        when: promoFieldsParsed,
      }),
      z.refine((data) => data.perGuestLimit === undefined || data.perGuestLimit > 0, {
        path: ["perGuestLimit"],
        error: "limitInvalid",
        when: promoFieldsParsed,
      }),
      z.refine((data) => data.maxDiscount === undefined || data.maxDiscount > 0, {
        path: ["maxDiscount"],
        error: "amountInvalid",
        when: promoFieldsParsed,
      }),
    ),
  z.transform(({ startsOn, endsOn, maxDiscount, ...rest }) => ({
    ...rest,
    // A cap only means something on a percentage.
    maxDiscount: rest.kind === "percent" ? maxDiscount : undefined,
    startsAt: startsOn ? cafeDayRange(startsOn).from.toISOString() : undefined,
    endsAt: endsOn ? cafeDayRange(endsOn).to.toISOString() : undefined,
  })),
);

export type PromoCodeFormInput = z.input<typeof promoCodeFormSchema>;
export type PromoCodeFormOutput = z.output<typeof promoCodeFormSchema>;

/** Switching a code on or off from the list. */
export const promoCodeActiveSchema = z.object({ isActive: z.boolean() });
export type PromoCodeActiveInput = z.input<typeof promoCodeActiveSchema>;

export const loyaltySettingsSchema = z.object({
  enabled: z.boolean(),
  tomanPerPoint: z.number().check(z.int("amountInvalid"), z.gte(1, "amountInvalid")),
  pointValue: z.number().check(z.int("amountInvalid"), z.gte(1, "amountInvalid")),
  minRedeemPoints: z.number().check(z.int("limitInvalid"), z.gte(0, "limitInvalid")),
});
export type LoyaltySettingsInput = z.input<typeof loyaltySettingsSchema>;

/** Staff adding or taking away a guest's points by hand. */
export const pointsAdjustmentSchema = z.object({
  phone: z.string().check(z.trim(), z.refine(isPlausiblePhone, "phoneInvalid")),
  delta: z.number().check(
    z.int("pointsInvalid"),
    z.refine((value) => value !== 0 && Math.abs(value) <= MAX_POINTS_ADJUSTMENT, "pointsInvalid"),
  ),
  note: z.string().check(z.trim(), z.minLength(1, "noteRequired"), z.maxLength(MAX_LOYALTY_NOTE_LENGTH, "noteTooLong")),
});
export type PointsAdjustmentInput = z.input<typeof pointsAdjustmentSchema>;
