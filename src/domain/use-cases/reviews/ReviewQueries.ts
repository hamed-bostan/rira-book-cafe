import { clampPageRequest, type Page, type PageRequest } from "../../entities/Pagination";
import {
  MAX_REVIEW_RATING,
  MIN_REVIEW_RATING,
  publicReviewLimit,
  ratingFromTotals,
  toPublicReview,
  type ProductReview,
  type PublicReviewPage,
  type RatingSummary,
  type ReviewedProduct,
  type ReviewEligibility,
  type ReviewStatus,
} from "../../entities/ProductReview";

import type { IReviewRepository, ReviewFilters } from "../../repositories/IReviewRepository";

/**
 * An item's approved reviews, newest first, as the public sees them — the first
 * `limit` (a whole number of pages, capped: see `publicReviewLimit`) and how many
 * there are in all, so the page knows whether to offer "Show more".
 */
export class ListProductReviews {
  constructor(private readonly reviewRepo: IReviewRepository) {}

  async execute(productId: string, limit?: number): Promise<PublicReviewPage> {
    const [reviews, total] = await Promise.all([
      this.reviewRepo.listApproved(productId, publicReviewLimit(limit)),
      this.reviewRepo.countApproved(productId),
    ]);
    return { items: reviews.map(toPublicReview), total };
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

/**
 * One page of the moderation queue, filtered by status tab, search, item and
 * stars. Staff only. A star count outside 1–5 is dropped rather than refused, the
 * way a stale URL's other filters are.
 */
export class ListReviews {
  constructor(private readonly reviewRepo: IReviewRepository) {}

  execute(filters: ReviewFilters, page: PageRequest): Promise<Page<ProductReview>> {
    const rating =
      filters.rating !== undefined &&
      Number.isInteger(filters.rating) &&
      filters.rating >= MIN_REVIEW_RATING &&
      filters.rating <= MAX_REVIEW_RATING
        ? filters.rating
        : undefined;
    return this.reviewRepo.list(
      {
        view: filters.view,
        q: filters.q?.trim() || undefined,
        productId: filters.productId?.trim() || undefined,
        rating,
      },
      clampPageRequest(page),
    );
  }
}

/** The items that have reviews, for the queue's item filter. Staff only. */
export class ListReviewedProducts {
  constructor(private readonly reviewRepo: IReviewRepository) {}

  execute(): Promise<ReviewedProduct[]> {
    return this.reviewRepo.listReviewedProducts();
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
