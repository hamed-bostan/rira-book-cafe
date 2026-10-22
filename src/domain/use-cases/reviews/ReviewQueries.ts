import {
  PUBLIC_REVIEW_LIMIT,
  ratingFromTotals,
  toPublicReview,
  type ProductReview,
  type PublicReview,
  type RatingSummary,
  type ReviewEligibility,
  type ReviewStatus,
} from "../../entities/ProductReview";

import type { IReviewRepository, ReviewFilters } from "../../repositories/IReviewRepository";

/** An item's approved reviews, as the public sees them. */
export class ListProductReviews {
  constructor(private readonly reviewRepo: IReviewRepository) {}

  async execute(productId: string): Promise<PublicReview[]> {
    const reviews = await this.reviewRepo.listApproved(productId, PUBLIC_REVIEW_LIMIT);
    return reviews.map(toPublicReview);
  }
}

/** Whether the guest can review an item (they've had it), and the review they already wrote. */
export class GetReviewEligibility {
  constructor(private readonly reviewRepo: IReviewRepository) {}

  async execute(productId: string, userId: string): Promise<ReviewEligibility> {
    const [canReview, review] = await Promise.all([
      this.reviewRepo.hasPurchased(userId, productId),
      this.reviewRepo.getOwn(productId, userId),
    ]);
    return { canReview, review };
  }
}

/** The moderation queue. Staff only. */
export class ListReviews {
  constructor(private readonly reviewRepo: IReviewRepository) {}

  execute(filters: ReviewFilters): Promise<ProductReview[]> {
    return this.reviewRepo.list({ view: filters.view, q: filters.q?.trim() || undefined });
  }
}

/** How many reviews sit in each status — the numbers on the queue's tabs. */
export class CountReviews {
  constructor(private readonly reviewRepo: IReviewRepository) {}

  execute(): Promise<Record<ReviewStatus, number>> {
    return this.reviewRepo.countByStatus();
  }
}

/** The average stars across every approved review, and how many — the queue's headline. Staff only. */
export class GetApprovedRating {
  constructor(private readonly reviewRepo: IReviewRepository) {}

  async execute(): Promise<RatingSummary> {
    const { sum, count } = await this.reviewRepo.approvedRatingTotals();
    return ratingFromTotals(sum, count);
  }
}
