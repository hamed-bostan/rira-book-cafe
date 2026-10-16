import { ApiError, type FieldErrors } from "./ApiError";

import type { AxiosError } from "axios";

/** The JSON error envelope every REST route handler returns on failure. */
export type ErrorEnvelope = {
  error?: { message?: string; code?: string; fieldErrors?: FieldErrors };
};

/**
 * Convert any Axios failure into a normalized `ApiError`. Shared by the browser
 * client (response interceptor) and the server-side BFF client, so both surface
 * one predictable error type regardless of where the request was made.
 */
export function normalizeAxiosError(error: AxiosError): ApiError {
  // The server answered with a non-2xx status.
  if (error.response) {
    const envelope = (error.response.data as ErrorEnvelope | undefined)?.error;
    return new ApiError(
      envelope?.message ?? defaultMessageForStatus(error.response.status),
      error.response.status,
      envelope?.code,
      envelope?.fieldErrors,
      { cause: error },
    );
  }

  // The request was sent but no response arrived (offline, DNS, CORS, timeout).
  const timedOut = error.code === "ECONNABORTED";
  return new ApiError(
    timedOut
      ? "The request timed out. Please try again."
      : "Can't reach the server. Check your connection and try again.",
    null,
    error.code,
    undefined,
    { cause: error },
  );
}

/** Last-resort message when the server didn't include one in the envelope. */
export function defaultMessageForStatus(status: number): string {
  if (status === 401 || status === 403) return "You're not authorized to do that.";
  if (status === 404) return "Not found.";
  if (status >= 500) return "Something went wrong on the server. Please try again.";
  return "Request failed.";
}
