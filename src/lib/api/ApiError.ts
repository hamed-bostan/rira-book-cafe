/**
 * Normalized client-side API error. The Axios response interceptor (see
 * `client.ts`) converts every failed request into one of these, so UI code
 * catches a single, predictable type instead of branching on Axios internals or
 * raw HTTP response shapes.
 */

/** Per-field validation messages, keyed by the field name the server rejected. */
export type FieldErrors = Record<string, string>;

export class ApiError extends Error {
  constructor(
    message: string,
    /** HTTP status, or `null` when the request never got a response (offline/timeout). */
    public readonly status: number | null,
    /** Machine-readable code from the error envelope, when the server sent one. */
    public readonly code?: string,
    /** Field-level validation messages, when the failure was a 400 validation error. */
    public readonly fieldErrors?: FieldErrors,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "ApiError";
  }

  /** True when the request never reached the server (offline, DNS, CORS, timeout). */
  get isNetworkError(): boolean {
    return this.status === null;
  }
}
