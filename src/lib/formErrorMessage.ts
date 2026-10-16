import type { useTranslations } from "next-intl";

/**
 * Form-validation copy lives in the `formErrors` message namespace; the Zod schemas
 * (shared by the client resolver and the API's defensive re-validation) author their
 * messages as that namespace's *keys*. This resolves a key to the active locale's
 * copy at display time — one translation point for both client-side validation and
 * server `fieldErrors`, which arrive as the same keys because the routes re-validate
 * with the same schemas.
 */

/** A translator bound to the `formErrors` namespace (`useTranslations("formErrors")`). */
export type FormErrorsTranslator = ReturnType<typeof useTranslations<"formErrors">>;

type FormErrorKey = Parameters<FormErrorsTranslator>[0];

/**
 * Resolve an RHF/Zod error message to user-facing copy. Unknown values — prose from a
 * server path that doesn't speak keys (e.g. a domain `ValidationError`) — pass through
 * unchanged rather than half-translated.
 */
export function formErrorMessage(
  t: FormErrorsTranslator,
  message: string | undefined,
): string | undefined {
  if (!message) return undefined;
  const key = message as FormErrorKey;
  return t.has(key) ? t(key) : message;
}
