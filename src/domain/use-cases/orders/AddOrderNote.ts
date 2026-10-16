import { MAX_ORDER_NOTE_LENGTH, type OrderNote } from "../../entities/OrderNote";
import { NotFoundError } from "../../errors/NotFoundError";
import { ValidationError } from "../../errors/ValidationError";

import type { ActivityActor } from "../../entities/ActivityEntry";
import type { IOrderNoteRepository } from "../../repositories/IOrderNoteRepository";
import type { IOrderRepository } from "../../repositories/IOrderRepository";


/**
 * Leave an internal note on an order. Requires `orders.note`, which every dashboard
 * role holds — it's the one write `support` has, and the reason that role is more
 * than a read-only viewer.
 *
 * The author comes from the session and is snapshotted onto the note, so it still
 * reads correctly once they're renamed or gone.
 *
 * Not recorded in the activity log, and that's deliberate rather than an omission:
 * the note *is* the record. An entry saying "someone added a note" beside a note
 * that already says who wrote it and when would be the same fact twice, and the log
 * is for changes to things — a note changes nothing about the order.
 */
export class AddOrderNote {
  constructor(
    private readonly noteRepo: IOrderNoteRepository,
    private readonly orderRepo: IOrderRepository,
  ) {}

  async execute(orderId: string, body: string, author: ActivityActor): Promise<OrderNote> {
    const trimmed = body.trim();
    if (!trimmed) throw new ValidationError("body", "A note can't be empty.");
    if (trimmed.length > MAX_ORDER_NOTE_LENGTH) {
      throw new ValidationError("body", `A note can be at most ${MAX_ORDER_NOTE_LENGTH} characters.`);
    }

    // Checked before writing: notes are append-only, so one attached to an order id
    // that never existed could never be cleaned up.
    const order = await this.orderRepo.getById(orderId);
    if (!order) throw new NotFoundError("order", orderId);

    return this.noteRepo.create({
      orderId,
      authorId: author.id,
      authorName: author.name,
      body: trimmed,
    });
  }
}
