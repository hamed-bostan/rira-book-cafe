/**
 * The request was well-formed but the current state refuses it: a table already
 * booked for that time, an event that's full, a status change the workflow
 * doesn't allow. Nothing was changed. `code` is the machine-readable reason the
 * client localizes; the presentation layer answers 409.
 */
export class ConflictError extends Error {
  constructor(
    public readonly code: ConflictCode,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "ConflictError";
  }
}

export type ConflictCode =
  | "TABLE_TAKEN"
  | "EVENT_FULL"
  | "EVENT_CLOSED"
  | "ALREADY_REGISTERED"
  | "INVALID_TRANSITION";
