import { ApiError } from "@/src/lib/api/ApiError";
import { localizeApiError, type ApiErrorsTranslator } from "@/src/lib/api/localizeApiError";
import { formErrorMessage, type FormErrorsTranslator } from "@/src/lib/formErrorMessage";

/**
 * What a failed expense write tells the person. The dialogs show one message, so
 * a field the server refused (an amount, a future date) is put in its words first;
 * anything else falls back to the request's own copy.
 */
export function expenseApiErrorMessage(
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
