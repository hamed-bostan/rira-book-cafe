import { z } from "zod";

/**
 * Free text — trimmed, with a blank value treated as absent. Never fails
 * validation: there's no membership or shape constraint an open text field
 * (a search box, a free-text id list) could violate, so "the user cleared the
 * field" and "the field was never set" collapse to the same `undefined`.
 */
export const trimmedTextParamSchema = z
  .string()
  .trim()
  .optional()
  .transform((value) => value || undefined);
