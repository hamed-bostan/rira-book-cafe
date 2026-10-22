import { ApiError } from "@/src/lib/api/ApiError";
import { localizeApiError, type ApiErrorsTranslator } from "@/src/lib/api/localizeApiError";
import { formErrorMessage, type FormErrorsTranslator } from "@/src/lib/formErrorMessage";

/**
 * What a failed stock write tells the person in a quick dialog. The dialogs show
 * one message, so a rejected field (a quantity the server refused, a future date)
 * is put in its words first; anything else falls back to the request's own copy.
 */
export function stockApiErrorMessage(
  error: unknown,
  tFormErrors: FormErrorsTranslator,
  tApiErrors: ApiErrorsTranslator,
  fallback: string,
): string {
  if (error instanceof ApiError) {
    const field = Object.values(error.fieldErrors ?? {}).find((message) => message.length > 0);
    if (field) return formErrorMessage(tFormErrors, field) ?? field;
  }
  return localizeApiError(error, tApiErrors, fallback);
}
