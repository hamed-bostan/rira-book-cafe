/**
 * Input failed a domain invariant before any persistence was attempted (e.g. a
 * required field was blank). Use-cases throw this as a typed, last-resort guard
 * behind the presentation layer's schema validation, so a direct caller — a seed
 * script, an importer, another action — still can't bypass the rule. The
 * presentation layer can surface `message` directly; `field` names the offender.
 */
export class ValidationError extends Error {
  constructor(
    /** The input field that failed validation, e.g. "slug". */
    public readonly field: string,
    /** A user-presentable explanation, e.g. "Slug is required." */
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "ValidationError";
  }
}
