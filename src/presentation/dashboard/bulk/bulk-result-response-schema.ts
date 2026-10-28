import { z } from "zod/mini";

/**
 * What a bulk endpoint answers with: how many rows the action actually changed.
 *
 * `updated` is not necessarily `ids.length` — ids that no longer exist and rows
 * already holding the target value are skipped — and the screen reports this number
 * rather than the selection size, so "12 of 20 updated" is something the admin can
 * see rather than a silent discrepancy.
 */
export const bulkResultSchema = z.object({
  updated: z.number(),
});

export type BulkResult = z.infer<typeof bulkResultSchema>;
