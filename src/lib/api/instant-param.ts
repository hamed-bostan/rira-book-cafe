import { z } from "zod";

/**
 * A free-form, `Date`-parseable query param, narrowed to an ISO instant.
 * Meant to be used as a field inside a larger `z.object({...})` filter schema
 * (see `admin-order-params.ts`, `admin-stock-movement-params.ts`) rather than
 * parsed standalone, so a rejected value's `ZodError` carries the field's own
 * name (`from`, `to`) for the `fieldErrors` response — a bare top-level parse
 * would report it as a root-level error instead.
 */
export const instantParamSchema = z
  .string()
  .transform((value, ctx) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Not a valid date." });
      return z.NEVER;
    }
    return parsed.toISOString();
  })
  .optional();
