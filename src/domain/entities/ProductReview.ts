/**
 * A guest's rating of something they bought: one to five stars and, optionally,
 * a few words. Only guests with a completed order for the item can review it —
 * every review is a verified purchase — and nothing is public until staff approve
 * it. An item's rating is the average of its approved reviews.
 */

/**
 * - `pending` — waiting for staff. Also where an edited review goes back to.
 * - `approved` — shown on the item's page and counted in its rating.
 * - `rejected` — hidden. Staff can still approve it later.
 */
export const REVIEW_STATUSES = ["pending", "approved", "rejected"] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

/** The statuses staff move a review to. */
export const MODERATION_STATUSES = ["approved", "rejected"] as const satisfies readonly ReviewStatus[];
export type ModerationStatus = (typeof MODERATION_STATUSES)[number];

export const MIN_REVIEW_RATING = 1;
export const MAX_REVIEW_RATING = 5;
export const MAX_REVIEW_COMMENT_LENGTH = 500;
/** How many approved reviews an item's page shows. */
export const PUBLIC_REVIEW_LIMIT = 20;

export type ProductReview = {
  id: string;
  productId: string;
  /** The item's name when the review was written — the moderation queue reads without a lookup. */
  productName: string;
  userId: string;
  /** The guest's name as it appears under the review. */
  authorName: string;
  /** Whole stars, 1–5. */
  rating: number;
  comment?: string;
  status: ReviewStatus;
  moderatedByName?: string;
  /** ISO 8601 (UTC). */
  moderatedAt?: string;
  createdAt: string;
  updatedAt: string;
};

/** A review as the public sees it: no account id, no moderation trail. */
export type PublicReview = Pick<ProductReview, "id" | "authorName" | "rating" | "comment" | "createdAt">;

export function toPublicReview(review: ProductReview): PublicReview {
  return {
    id: review.id,
    authorName: review.authorName,
    rating: review.rating,
    comment: review.comment,
    createdAt: review.createdAt,
  };
}

/** Whether a guest may review an item, and their review if they already wrote one. */
export type ReviewEligibility = {
  /** They have a completed order containing the item. */
  canReview: boolean;
  review: ProductReview | null;
};

/** An item's rating from its approved reviews' stars: the average to one decimal, and how many. */
export function ratingSummary(ratings: readonly number[]): { rating: number; ratingCount: number } {
  if (ratings.length === 0) return { rating: 0, ratingCount: 0 };
  const average = ratings.reduce((sum, value) => sum + value, 0) / ratings.length;
  return { rating: Math.round(average * 10) / 10, ratingCount: ratings.length };
}

/**
 * The first name, or the name as given — reviews show who wrote them without the
 * guest's full name. The placeholder name new accounts get reads as anonymous.
 */
export function reviewAuthorName(name: string, placeholder: string): string {
  const trimmed = name.trim();
  if (!trimmed || trimmed === placeholder) return "";
  return trimmed.split(/\s+/)[0];
}
