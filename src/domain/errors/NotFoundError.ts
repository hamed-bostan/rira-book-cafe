/**
 * A requested entity does not exist. Use-cases throw this when an operation
 * targets a record that isn't there (e.g. update/delete by an unknown id), and a
 * repository raises it when the driver reports the row vanished (e.g. Prisma's
 * P2025). Either way the presentation layer can answer 404 without depending on
 * the persistence driver or its native codes.
 */
export class NotFoundError extends Error {
  constructor(
    /** The entity type that wasn't found, e.g. "category". */
    public readonly entity: string,
    /** The identifier that didn't match, when known. */
    public readonly identifier?: string,
    options?: { cause?: unknown },
  ) {
    super(
      identifier ? `${entity} "${identifier}" was not found.` : `${entity} was not found.`,
      options,
    );
    this.name = "NotFoundError";
  }
}
