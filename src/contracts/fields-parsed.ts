import type { z } from "zod";

/**
 * The `when` of an object's (or array's) `.refine()`/`.superRefine()`, keeping Zod 3's
 * timing: the rule waits while one of the named fields failed *before* its
 * `.transform()`.
 *
 * Zod 4 runs an object's refinements even then, and a field that failed before its
 * transform still holds the raw form string ("" or "abc" where the rule expects a
 * number), so the rule could add a second, misleading error (a blank amount reported
 * as "VAT too high"). Zod 3 skipped the object's rules in that case — but still ran
 * them after a check *following* the transform failed (an amount of 0), and so does
 * this.
 *
 * Name every field of the object that transforms after a check, as a dotted path
 * with `*` for every array index (`"lines.*.cost"`). Each must either parse to
 * something other than a string (an amount, a count) or have no check after its
 * transform (free text): a field that failed and still holds a string is one that
 * never reached its transform. Like Zod's own default, an aborting issue anywhere (a
 * wrong type, an unknown enum value) still skips the rule, while an issue another
 * rule of the same object raised doesn't.
 */
export function fieldsParsed(...fields: string[]): (payload: z.core.ParsePayload) => boolean {
  const patterns = fields.map((field) => field.split("."));
  const valueAt = (root: unknown, path: readonly PropertyKey[]): unknown =>
    path.reduce<unknown>(
      (node, key) =>
        typeof node === "object" && node !== null ? (node as Record<PropertyKey, unknown>)[key] : undefined,
      root,
    );
  const failedBeforeTransform = (root: unknown, path: readonly PropertyKey[]): boolean =>
    patterns.some(
      (pattern) =>
        pattern.length <= path.length &&
        pattern.every((segment, index) => segment === "*" || segment === String(path[index])) &&
        typeof valueAt(root, path.slice(0, pattern.length)) === "string",
    );
  return (payload) =>
    !payload.aborted &&
    payload.issues.every(
      // A rule's own issue carries the whole object as its input; a field's carries the field's.
      (issue) =>
        issue.continue === true &&
        (issue.input === payload.value || !failedBeforeTransform(payload.value, issue.path ?? [])),
    );
}
