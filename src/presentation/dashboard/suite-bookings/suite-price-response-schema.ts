import { z } from "zod/mini";

import type { SuiteSettings } from "@/src/domain/entities/SuitePricing";

/** What the suite's price endpoint returns. */
export const suiteSettingsResponseSchema = z.object({
  nightlyRate: z.number(),
}) satisfies z.ZodMiniType<SuiteSettings>;
