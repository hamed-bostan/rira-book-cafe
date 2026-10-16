import type { OrderNote } from "../entities/OrderNote";

/** A note about to be written. The id and timestamp are the repository's to assign. */
export type NewOrderNote = Omit<OrderNote, "id" | "createdAt">;

/**
 * Internal notes on orders.
 *
 * Deliberately two methods. There is no update and no delete, here or in the
 * implementation or the migration — notes are a record of what people knew and
 * when, and one that can be revised afterwards isn't a record. The same reasoning
 * `IActivityLog` and `IStockMovementLog` are built on.
 */
export type IOrderNoteRepository = {
  /** One order's notes, newest first. */
  listForOrder(orderId: string): Promise<OrderNote[]>;
  /** Notes across a set of orders, newest first. Used by customer support views. */
  listForOrders(orderIds: readonly string[]): Promise<OrderNote[]>;
  /** Append a note, returning it with its assigned id and timestamp. */
  create(input: NewOrderNote): Promise<OrderNote>;
};
