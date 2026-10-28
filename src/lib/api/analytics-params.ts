import {
  ANALYTICS_RANGE_PRESETS,
  DEFAULT_ANALYTICS_PRESET,
  MAX_RANGE_DAYS,
  TOP_ITEM_SORTS,
  dayRange,
  presetRange,
  rangeDays,
  type AnalyticsRangePreset,
  type DateRange,
  type TopItemSort,
} from "@/src/domain/entities/Analytics";
import { isCafeDay } from "@/src/domain/entities/CafeTime";

import * as z from "../zod";

/**
 * The single wire contract for a report's range — the screens write these query
 * params and the report routes parse them back. Either a preset (`?range=7d`) or a
 * custom span of cafe days (`?from=2026-10-01&to=2026-10-15`, both inclusive).
 * Anything malformed is a `$ZodError`, which the route answers with a 400.
 */
const rangeQuerySchema = z
  .object({
    range: z.optional(z.enum(ANALYTICS_RANGE_PRESETS)),
    from: z.optional(z.string().check(z.refine(isCafeDay, "Expected YYYY-MM-DD."))),
    to: z.optional(z.string().check(z.refine(isCafeDay, "Expected YYYY-MM-DD."))),
  })
  .check(
    z.refine((value) => (value.from === undefined) === (value.to === undefined), {
      error: "`from` and `to` go together.",
      path: ["to"],
    }),
    z.refine((value) => !value.from || !value.to || value.from <= value.to, {
      error: "`to` must be on or after `from`.",
      path: ["to"],
    }),
  );

/** Parse a report range from a query string; a preset when no custom span is given. */
export function parseAnalyticsRange(params: URLSearchParams, now: Date = new Date()): DateRange {
  const query = rangeQuerySchema.parse({
    range: params.get("range") ?? undefined,
    from: params.get("from") ?? undefined,
    to: params.get("to") ?? undefined,
  });
  if (query.from && query.to) {
    const range = dayRange(query.from, query.to);
    if (rangeDays(range) > MAX_RANGE_DAYS) {
      throw new z.core.$ZodError([{ code: "custom", path: ["from"], message: `At most ${MAX_RANGE_DAYS} days.` }]);
    }
    return range;
  }
  return presetRange(query.range ?? DEFAULT_ANALYTICS_PRESET, now);
}

/** The preset the screen should highlight, or `"custom"` when a span is given. */
export function selectedRangeOption(params: URLSearchParams): AnalyticsRangePreset | "custom" {
  if (params.get("from") && params.get("to")) return "custom";
  const range = params.get("range");
  return (ANALYTICS_RANGE_PRESETS as readonly string[]).includes(range ?? "")
    ? (range as AnalyticsRangePreset)
    : DEFAULT_ANALYTICS_PRESET;
}

/** The top-items ordering from `?sort=`, defaulting to revenue. */
export function parseTopItemSort(params: URLSearchParams): TopItemSort {
  const sort = params.get("sort");
  return (TOP_ITEM_SORTS as readonly string[]).includes(sort ?? "") ? (sort as TopItemSort) : "revenue";
}

/** Only the range params of a query string, to forward to a report endpoint. */
export function rangeParams(params: URLSearchParams): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of ["range", "from", "to", "sort"]) {
    const value = params.get(key);
    if (value) out[key] = value;
  }
  return out;
}
