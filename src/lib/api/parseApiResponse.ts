import { safeParse, type $ZodType } from "zod/v4/core";

import { ApiError } from "./ApiError";

/**
 * Response-shape validation — the seam both REST clients share, so a body that
 * isn't what the typed service promised fails the same way on the server and in
 * the browser.
 *
 * A 2xx status is no guarantee of a usable body: a proxy can answer with an HTML
 * error page, a body can arrive truncated, and an endpoint can drift from the
 * entity the service claims to return. `fetch` at least throws a raw `SyntaxError`
 * on unparseable JSON; Axios doesn't even do that — its default `transformResponse`
 * silently leaves `data` as the raw string, so a component gets a `string` where it
 * expects `T` and renders garbage. Neither failure fits the `ApiError` contract
 * every caller is written against.
 *
 * Both are normalized here into an `ApiError` carrying `BAD_RESPONSE_CODE`.
 *
 * Typed against zod 4's core rather than either of its builds, so both are accepted:
 * the response schemas use `zod/mini`, which every page can afford to carry, while
 * the shared form contracts stay on classic `zod`.
 */

/** `code` on every `ApiError` raised for a malformed or shape-mismatched body. */
export const BAD_RESPONSE_CODE = "EBADRESPONSE";

const BAD_RESPONSE_MESSAGE = "The server returned a malformed response. Please try again.";

/** Validate a response body against the schema the typed service declares. */
export function parseApiResponse<T>(schema: $ZodType<T>, data: unknown, status: number | null): T {
  const result = safeParse(schema, data);
  if (result.success) return result.data;

  // The user-facing message stays generic; the mismatch itself is only useful to
  // whoever has to fix the endpoint, so log it rather than surface it.
  console.error("Malformed API response:", result.error.issues);
  throw badResponseError(status, result.error);
}

/** An `ApiError` for a body that couldn't be parsed or didn't match its schema. */
export function badResponseError(status: number | null, cause: unknown): ApiError {
  return new ApiError(BAD_RESPONSE_MESSAGE, status, BAD_RESPONSE_CODE, undefined, { cause });
}
