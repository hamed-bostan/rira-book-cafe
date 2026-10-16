/**
 * A record can't be removed because something depends on it — the request was
 * well-formed and the record exists, the *state* is what refuses. The presentation
 * layer answers 409, like the other "your input was fine, the world wasn't" cases
 * (`InsufficientStockError`, `SlotUnavailableError`).
 *
 * Deleting anyway would strand the dependents: a delivery window with orders
 * booked into it leaves those customers with a delivery time nothing can resolve.
 * The message names what's in the way so the operator knows what to clear first.
 */
export class ResourceInUseError extends Error {
  constructor(
    /** The entity type being removed, e.g. "delivery window". */
    public readonly entity: string,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "ResourceInUseError";
  }
}
