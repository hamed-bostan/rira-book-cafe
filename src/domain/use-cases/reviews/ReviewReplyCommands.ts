import { MAX_REVIEW_REPLY_LENGTH, type ProductReview } from "../../entities/ProductReview";
import { ConflictError } from "../../errors/ConflictError";
import { NotFoundError } from "../../errors/NotFoundError";
import { ValidationError } from "../../errors/ValidationError";

import type { ActivityActor } from "../../entities/ActivityEntry";
import type { ICustomerNotifier } from "../../repositories/INotificationRepository";
import type { IReviewRepository } from "../../repositories/IReviewRepository";

/**
 * Staff post or edit the cafe's one public reply under a review. Only a review
 * guests can see (approved) takes a reply — an answer under a hidden review would
 * be an answer to nobody. The guest is told in their messages the first time a
 * reply goes up (an edit isn't news); the entry commits with the reply.
 */
export class ReplyToReview {
  constructor(
    private readonly reviewRepo: IReviewRepository,
    /** Tells the guest the cafe answered. */
    private readonly notifier?: ICustomerNotifier,
  ) {}

  async execute(id: string, text: string, staff: ActivityActor, now: Date): Promise<ProductReview> {
    const words = text.trim();
    if (!words) throw new ValidationError("text", "Write the reply.");
    if (words.length > MAX_REVIEW_REPLY_LENGTH) {
      throw new ValidationError("text", `Keep the reply to ${MAX_REVIEW_REPLY_LENGTH} characters.`);
    }

    const current = await this.reviewRepo.getById(id);
    if (!current) throw new NotFoundError("review", id);
    if (current.status !== "approved") {
      throw new ConflictError("REVIEW_NOT_APPROVED", "Only a review that's shown on the menu can get a reply.");
    }
    if (current.reply?.text === words) return current;

    const saved = await this.reviewRepo.setReply(id, { text: words, by: staff, at: now }, (result) => ({
      actorId: staff.id,
      actorName: staff.name,
      action: "review.replied",
      entityType: "review",
      entityId: result.id,
      entityLabel: result.productName,
      changes: [{ field: "reply", before: current.reply?.text ?? null, after: words }],
    }));

    // After the reply committed; the notifier never throws (see `ICustomerNotifier`).
    if (!current.reply && saved.reply && this.notifier) {
      await this.notifier.notify({
        userId: saved.userId,
        kind: "reviewReplied",
        params: { productName: saved.productName },
        link: `/menu/${saved.productId}#reviews`,
        dedupeKey: `review:${saved.id}:reply:${saved.reply.at}`,
      });
    }
    return saved;
  }
}

/** Staff take the cafe's reply down from under a review. Nothing to do when there's none. */
export class RemoveReviewReply {
  constructor(private readonly reviewRepo: IReviewRepository) {}

  async execute(id: string, staff: ActivityActor): Promise<ProductReview> {
    const current = await this.reviewRepo.getById(id);
    if (!current) throw new NotFoundError("review", id);
    const previous = current.reply;
    if (!previous) return current;

    return this.reviewRepo.setReply(id, null, (result) => ({
      actorId: staff.id,
      actorName: staff.name,
      action: "review.replyRemoved",
      entityType: "review",
      entityId: result.id,
      entityLabel: result.productName,
      changes: [{ field: "reply", before: previous.text, after: null }],
    }));
  }
}

/**
 * Staff delete a review for good — spam, abuse, a review of the wrong thing. The
 * item's rating and count are recomputed in the same transaction, and the entry
 * (committed with the delete) is the only record left of what it said.
 */
export class DeleteReview {
  constructor(private readonly reviewRepo: IReviewRepository) {}

  async execute(id: string, staff: ActivityActor): Promise<void> {
    const deleted = await this.reviewRepo.delete(id, (review) => ({
      actorId: staff.id,
      actorName: staff.name,
      action: "review.deleted",
      entityType: "review",
      entityId: review.id,
      entityLabel: review.productName,
      changes: [
        { field: "author", before: review.authorName || null, after: null },
        { field: "rating", before: String(review.rating), after: null },
        { field: "comment", before: review.comment ?? null, after: null },
        { field: "status", before: review.status, after: null },
        { field: "reply", before: review.reply?.text ?? null, after: null },
      ].filter((change) => change.before !== null),
    }));
    if (!deleted) throw new NotFoundError("review", id);
  }
}

/**
 * A guest deletes their own review of an item. Their review, so there's no staff
 * entry (a guest writing one isn't logged either); the item's rating is recomputed
 * in the same transaction. They can write a new one afterwards — it waits for
 * staff like any other.
 */
export class DeleteOwnReview {
  constructor(private readonly reviewRepo: IReviewRepository) {}

  async execute(productId: string, userId: string): Promise<void> {
    const own = await this.reviewRepo.getOwn(productId, userId);
    if (!own) throw new NotFoundError("review", productId);
    await this.reviewRepo.delete(own.id);
  }
}
