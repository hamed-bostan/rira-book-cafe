import { z } from "zod/mini";

import type { CafeTable } from "@/src/domain/entities/CafeTable";

/** One table as `/api/admin/tables` returns it. */
export const cafeTableResponseSchema = z.object({
  id: z.string(),
  label: z.string(),
  seats: z.number(),
  area: z.optional(z.string()),
  isActive: z.boolean(),
  position: z.number(),
}) satisfies z.ZodMiniType<CafeTable>;

export const cafeTableListResponseSchema = z.array(cafeTableResponseSchema);
