import { ACTIVITY_RETENTION_MONTHS } from "@/src/domain/entities/TeamSettings";
import * as z from "@/src/lib/zod";

/**
 * The owner's team settings, shared by the settings route and its form. Retention is
 * one of the offered periods (in months), or `null` to keep the log forever.
 * Messages are `formErrors` keys, translated at display time.
 */
export const teamSettingsSchema = z.object({
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
