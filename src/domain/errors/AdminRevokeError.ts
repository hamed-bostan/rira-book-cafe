/**
 * Removing an admin was refused because it would break a rule that protects
 * continued access to the dashboard. Distinct from `ValidationError` because the
 * input is well-formed — the *state* makes the operation unsafe — so it maps to
 * 409 Conflict, and `reason` gives the UI a precise message rather than a generic
 * "that didn't work".
 */
export type AdminRevokeReason =
  /** The caller tried to remove their own access (or hand ownership to themselves). */
  | "self"
  /** The caller tried to remove the owner, who must transfer ownership first. */
  | "owner";

export class AdminRevokeError extends Error {
  constructor(
    public readonly reason: AdminRevokeReason,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "AdminRevokeError";
  }
}
