import type { ILogger } from "@/src/domain/repositories/ILogger";
import { logger } from "@/src/infrastructure/container";

/**
 * Correlation header. The host nginx stamps every request with its own
 * `$request_id` (see `deploy/nginx-rira.conf`) and logs it, so one id ties the
 * access log, these app log lines and any error-tracker event together.
 */
export const REQUEST_ID_HEADER = "x-request-id";

// Accept only a plain token: the header is client-controlled when the app is hit directly.
const REQUEST_ID_PATTERN = /^[\w.-]{1,128}$/;

/** The app logger, bound to this request's id when the proxy supplied one. */
export function requestLogger(request: Request): ILogger {
  const requestId = request.headers.get(REQUEST_ID_HEADER);
  return requestId && REQUEST_ID_PATTERN.test(requestId) ? logger.child({ requestId }) : logger;
}
