/**
 * A unique constraint was violated (e.g. a duplicate slug). Thrown in two places:
 * a repository raises it when the driver reports a violation (e.g. Prisma's P2002,
 * translated to this in infrastructure), and a use-case raises it when a pre-write
 * check finds the same collision first. Either way the presentation layer reacts
 * to one error type without depending on a specific database or its native codes.
 */
export class UniqueConstraintError extends Error {
  constructor(
    /** The field(s) whose uniqueness was violated, when the driver reports them. */
    public readonly fields: readonly string[],
    options?: { cause?: unknown },
  ) {
    super(
      fields.length > 0
        ? `Unique constraint violated on: ${fields.join(", ")}.`
        : "Unique constraint violated.",
      options,
    );
    this.name = "UniqueConstraintError";
  }
}
