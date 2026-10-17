import {
  MAX_REVIEW_COMMENT_LENGTH,
  MAX_REVIEW_RATING,
  MIN_REVIEW_RATING,
  reviewAuthorName,
  type ModerationStatus,
  type ProductReview,
} from "../../entities/ProductReview";
import { PLACEHOLDER_USER_NAME, type User } from "../../entities/User";
import { ConflictError } from "../../errors/ConflictError";
import { NotFoundError } from "../../errors/NotFoundError";
import { ValidationError } from "../../errors/ValidationError";

import type { ActivityActor } from "../../entities/ActivityEntry";
import type { ICustomerNotifier } from "../../repositories/INotificationRepository";
import type { IProductRepository } from "../../repositories/IProductRepository";
import type { IReviewRepository } from "../../repositories/IReviewRepository";

export type SubmitReviewInput = {
  rating: number;
  comment?: string;
};

/**
 * A guest reviews something they bought, or rewrites their review of it. Only a
 * guest with a completed order for the item may; the review waits for staff
 * before it's shown, and a rewrite waits again.
 */
export class SubmitReview {
  constructor(
    private readonly reviewRepo: IReviewRepository,
    private readonly productRepo: Pick<IProductRepository, "getPublishedById">,
  ) {}

  async execute(productId: string, input: SubmitReviewInput, guest: Pick<User, "id" | "name">): Promise<ProductReview> {
    if (!Number.isInteger(input.rating) || input.rating < MIN_REVIEW_RATING || input.rating > MAX_REVIEW_RATING) {
      throw new ValidationError("rating", `Choose ${MIN_REVIEW_RATING} to ${MAX_REVIEW_RATING} stars.`);
    }
    const comment = input.comment?.trim() || undefined;
    if (comment && comment.length > MAX_REVIEW_COMMENT_LENGTH) throw new ValidationError("comment", "That review is too long.");

    const product = await this.productRepo.getPublishedById(productId);
    if (!product) throw new NotFoundError("product", productId);
    if (!(await this.reviewRepo.hasPurchased(guest.id, productId))) {
      throw new ConflictError("NOT_PURCHASED", "Only guests who've had this item can review it.");
    }

    return this.reviewRepo.saveOwn({
      productId,
      productName: product.name,
      userId: guest.id,
      authorName: reviewAuthorName(guest.name, PLACEHOLDER_USER_NAME),
      rating: input.rating,
      comment,
    });
  }
}

/** Staff approve a review (it's shown and counted) or reject it (hidden). */
export class ModerateReview {
  constructor(
    private readonly reviewRepo: IReviewRepository,
    /** Tells the guest their review went up. */
    private readonly notifier?: ICustomerNotifier,
  ) {}

  async execute(id: string, status: ModerationStatus, staff: ActivityActor, now: Date): Promise<ProductReview> {
    const current = await this.reviewRepo.getById(id);
    if (!current) throw new NotFoundError("review", id);
    if (current.status === status) return current;

    const saved = await this.reviewRepo.moderate(id, current.status, status, staff, now, (result) => ({
      actorId: staff.id,
      actorName: staff.name,
      action: "review.moderated",
      entityType: "review",
      entityId: result.id,
      entityLabel: result.productName,
      changes: [{ field: "status", before: current.status, after: result.status }],
    }));

    if (saved.status === "approved" && this.notifier) {
      await this.notifier.notify({
        userId: saved.userId,
        kind: "reviewApproved",
        params: { productName: saved.productName },
        link: `/menu/${saved.productId}`,
        dedupeKey: `review:${saved.id}:approved:${saved.updatedAt}`,
      });
    }
    return saved;
  }
}
