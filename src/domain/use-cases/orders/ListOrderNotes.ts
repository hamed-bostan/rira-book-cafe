import type { OrderNote } from "../../entities/OrderNote";
import type { IOrderNoteRepository } from "../../repositories/IOrderNoteRepository";

/**
 * One order's internal notes, newest first. A cross-user read of staff-facing
 * data — gate the caller to the dashboard.
 *
 * Uncapped, unlike the activity panel beside it: the log accumulates an entry per
 * change and needs a limit, while notes are written by hand and an order with
 * enough of them to be a problem is an order someone should read all of.
 */
export class ListOrderNotes {
  constructor(private readonly noteRepo: IOrderNoteRepository) {}

  execute(orderId: string): Promise<OrderNote[]> {
    return this.noteRepo.listForOrder(orderId);
  }
}
