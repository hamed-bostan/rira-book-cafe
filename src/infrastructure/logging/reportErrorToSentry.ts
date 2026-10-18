import * as Sentry from "@sentry/nextjs";

import type { ErrorReport } from "./PinoLogger";

/**
 * Forwards error-level log lines to the error tracker. Route handlers catch
 * unexpected errors to answer with the standard 500 envelope, so those never
 * reach Next's `onRequestError` — logging them is where they get reported.
 *
 * A no-op when Sentry isn't initialized (no DSN). The event still passes through
 * `beforeSend`, so the PII scrubbing in `scrubPii` applies to these fields too.
 */
export function reportErrorToSentry({ message, error, fields }: ErrorReport): void {
  Sentry.withScope((scope) => {
    const { requestId, ...extra } = fields;
    if (typeof requestId === "string") scope.setTag("request_id", requestId);
    scope.setExtras({ ...extra, logMessage: message });
    if (error !== undefined && !(error instanceof Error)) scope.setExtra("thrown", error);

    if (error instanceof Error) Sentry.captureException(error);
    else Sentry.captureMessage(message, "error");
  });
}
