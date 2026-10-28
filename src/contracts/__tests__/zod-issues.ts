import { flattenError } from "zod/mini";

import type { $ZodError, $ZodFlattenedError } from "zod/v4/core";

/** Either branch of a `safeParse` result — only the error side is read. */
type ParseResult = { success: boolean; error?: $ZodError };

/**
 * The messages of the issues sitting at exactly `path`, dot-joined (`"lines.0.debit"`);
 * `""` is the root. For nested paths, where `flattened(...).fieldErrors` only keys the
 * first segment.
 */
export function messagesAt(result: ParseResult, path: string): string[] {
  return (result.error?.issues ?? []).filter((issue) => issue.path.join(".") === path).map((issue) => issue.message);
}

/**
 * A `safeParse` error flattened to `{ formErrors, fieldErrors }` — `undefined` when it
 * parsed. Mini's errors have no `.flatten()` method; this reads like classic's
 * `result.error?.flatten()`.
 */
export function flattened<T>(error: $ZodError<T> | undefined): $ZodFlattenedError<T> | undefined {
  return error && flattenError(error);
}
