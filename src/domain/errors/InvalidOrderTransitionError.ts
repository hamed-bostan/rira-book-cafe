import type { OrderStatus } from "../entities/Order";

/**
 * A status change the workflow doesn't allow — completing a cancelled order, or
 * cancelling one that's already ready — or one that lost a race with another
 * change (two baristas pressing "accept" at once). Nothing was changed. The
 * presentation layer answers 409 so the screen can refresh and show the real state.
 */
export class InvalidOrderTransitionError extends Error {
  constructor(
    public readonly from: OrderStatus,
    public readonly to: OrderStatus,
    options?: { cause?: unknown },
  ) {
    super(`An order can't move from "${from}" to "${to}".`, options);
    this.name = "InvalidOrderTransitionError";
  }
}
