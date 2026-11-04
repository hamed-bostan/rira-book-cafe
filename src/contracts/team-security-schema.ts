import { ACTIVITY_RETENTION_MONTHS } from "@/src/domain/entities/TeamSettings";
import * as z from "@/src/lib/zod";

/**
 * The team's security forms and their routes: the owner's settings, and the codes a
 * dashboard user types for authenticator-app two-factor. Messages are `formErrors`
 * keys, translated at display time.
 */

/**
 * The owner's team settings. Either field alone is a valid save. Retention is one of
 * the offered periods (in months), or `null` to keep the log forever.
 */
export const teamSettingsSchema = z.object({
  requireTwoFactor: z.optional(z.boolean()),
  activityRetentionMonths: z.optional(
    z.nullable(
      z
        .number()
        .check(
          z.refine((value) => (ACTIVITY_RETENTION_MONTHS as readonly number[]).includes(value), "retentionInvalid"),
        ),
    ),
  ),
});

export type TeamSettingsInput = z.infer<typeof teamSettingsSchema>;

/** Six digits from the authenticator app, however they were typed (spaces, Persian digits). */
const totpCode = z
  .string()
  .check(z.trim(), z.minLength(1, "twoFactorCodeRequired"), z.maxLength(20, "twoFactorCodeInvalid"));

/** Confirming enrolment: the first code from the app. */
export const twoFactorCodeSchema = z.object({ code: totpCode });

export type TwoFactorCodeInput = z.infer<typeof twoFactorCodeSchema>;

/**
 * Passing the check, or turning two-factor off: a code from the app, or one of the
 * recovery codes shown at enrolment.
 */
export const secondFactorSchema = z.union([
  z.object({ code: totpCode }),
  z.object({
    recoveryCode: z
      .string()
      .check(z.trim(), z.minLength(1, "twoFactorCodeRequired"), z.maxLength(40, "twoFactorCodeInvalid")),
  }),
]);

export type SecondFactorInput = z.infer<typeof secondFactorSchema>;
