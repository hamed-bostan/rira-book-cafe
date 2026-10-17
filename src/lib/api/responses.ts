import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { AdminRevokeError } from "@/src/domain/errors/AdminRevokeError";
import { ConflictError } from "@/src/domain/errors/ConflictError";
import { InsufficientStockError } from "@/src/domain/errors/InsufficientStockError";
import { InvalidOrderTransitionError } from "@/src/domain/errors/InvalidOrderTransitionError";
import { NotFoundError } from "@/src/domain/errors/NotFoundError";
import { PaymentGatewayError } from "@/src/domain/errors/PaymentGatewayError";
import { ResourceInUseError } from "@/src/domain/errors/ResourceInUseError";
import { UniqueConstraintError } from "@/src/domain/errors/UniqueConstraintError";
import { ValidationError } from "@/src/domain/errors/ValidationError";
import type { ILogger } from "@/src/domain/repositories/ILogger";
import { logger } from "@/src/infrastructure/container";

/**
 * Server-side helpers for REST route handlers (Next.js `app/api/**` only — never
 * import these from client code; they pull in `next/server`).
 *
 * They keep every endpoint speaking one consistent JSON contract:
 *   success → the resource (or 204 No Content)
 *   failure → `{ error: { message, code?, fieldErrors? } }`
 * so the Axios response interceptor can normalize failures uniformly.
 */

type ErrorBody = {
  message: string;
  code?: string;
  fieldErrors?: Record<string, string>;
};

/** Build a failure response with the standard envelope. */
export function errorResponse(status: number, body: ErrorBody): NextResponse {
  return NextResponse.json({ error: body }, { status });
}

/** 401 for a missing/non-admin session on a protected (write) endpoint. */
export function unauthorizedResponse(): NextResponse {
  return errorResponse(401, { message: "You're not authorized to do that.", code: "UNAUTHORIZED" });
}

/**
 * Translate a thrown error into the correct HTTP response. Known domain errors
 * map to 4xx with a user-presentable message; anything else is an unexpected 500
 * and is logged server-side (its detail is never leaked to the client).
 */
export function errorResponseFromException(error: unknown, context: string, log: ILogger = logger): NextResponse {
  // A query-param or body schema rejected the request — the client's fault, not
  // an unexpected failure, so it's a 400 with per-field detail rather than a
  // logged 500.
  if (error instanceof ZodError) {
    return errorResponse(400, {
      message: "One or more query parameters are invalid.",
      code: "VALIDATION",
      fieldErrors: firstFieldErrors(error),
    });
  }

  if (error instanceof UniqueConstraintError) {
    const message = error.fields.length
      ? `That ${error.fields.join(", ")} is already taken.`
      : "That value is already taken.";
    return errorResponse(409, {
      message,
      code: "UNIQUE_CONSTRAINT",
      // `fieldErrors` speak `formErrors` message keys (like the Zod schemas the routes
      // re-validate with), so the client translates them at display time.
      fieldErrors: Object.fromEntries(error.fields.map((field) => [field, "alreadyTaken"])),
    });
  }

  if (error instanceof ValidationError) {
    return errorResponse(400, {
      message: error.message,
      code: "VALIDATION",
      fieldErrors: { [error.field]: error.message },
    });
  }

  if (error instanceof NotFoundError) {
    return errorResponse(404, { message: `That ${error.entity} no longer exists.`, code: "NOT_FOUND" });
  }

  // Something still depends on the record being removed (e.g. a delivery window
  // with orders booked into it). Well-formed request, refusing state → 409, and the
  // message names what's in the way.
  // The state refuses the request (table taken, event full, …). 409 with the
  // machine-readable reason as the code, which the client localizes.
  if (error instanceof ConflictError) {
    return errorResponse(409, { message: error.message, code: error.code });
  }

  // An order asked for more than is on hand (or an item sold out meanwhile).
  // 409 Conflict — the message names what's short.
  if (error instanceof InsufficientStockError) {
    return errorResponse(409, { message: error.message, code: "INSUFFICIENT_STOCK" });
  }

  // A status change the workflow refuses, or one that lost a race with another
  // change. 409 — the client refreshes to show the order's real state.
  if (error instanceof InvalidOrderTransitionError) {
    return errorResponse(409, { message: error.message, code: "INVALID_TRANSITION" });
  }

  // Removing an admin was refused to keep the dashboard reachable (self-removal,
  // or the owner). The input was fine, the state wasn't → 409, and `reason` picks
  // the precise copy client-side.
  if (error instanceof AdminRevokeError) {
    return errorResponse(409, {
      message: error.message,
      code: error.reason === "self" ? "REVOKE_SELF" : "REVOKE_OWNER",
    });
  }

  if (error instanceof ResourceInUseError) {
    return errorResponse(409, { message: error.message, code: "IN_USE" });
  }

  // The payment gateway was unreachable or refused. Logged (it's an upstream
  // problem worth seeing), answered 502 so the client says "try again".
  if (error instanceof PaymentGatewayError) {
    log.error("Payment gateway unavailable", { error, context });
    return errorResponse(502, { message: "The payment gateway isn't available right now.", code: "GATEWAY_UNAVAILABLE" });
  }

  log.error("Unhandled error in route handler", { error, context });
  return errorResponse(500, { message: "Something went wrong. Please try again.", code: "INTERNAL" });
}

/** Read and JSON-parse a request body, distinguishing "absent/invalid" from valid. */
export async function parseJsonBody(request: Request): Promise<{ ok: true; data: unknown } | { ok: false }> {
  try {
    return { ok: true, data: await request.json() };
  } catch {
    return { ok: false };
  }
}

/** Collapse a Zod error into one message per field for the `fieldErrors` envelope. */
export function firstFieldErrors(error: ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [field, messages] of Object.entries(error.flatten().fieldErrors)) {
    if (messages && messages.length > 0) result[field] = messages[0];
  }
  return result;
}
