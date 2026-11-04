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
/** The longest reply the cafe writes under a review: a short answer, not a letter. */
export const MAX_REVIEW_REPLY_LENGTH = 1000;
/** How many approved reviews an item's page shows at first, and how many more each "Show more" adds. */
export const PUBLIC_REVIEW_LIMIT = 20;
/**
 * The most an item's page will list however far "Show more" goes: the page is
 * server-rendered whole each time, so it stays bounded. Past this, the summary's
 * count still says how many there are.
 */
export const MAX_PUBLIC_REVIEW_LIMIT = 200;

/** How many reviews to show for an item page's `?reviews=` — a whole number of pages, within bounds. */
export function publicReviewLimit(requested: number | undefined): number {
  if (requested === undefined || !Number.isFinite(requested)) return PUBLIC_REVIEW_LIMIT;
  const pages = Math.max(1, Math.ceil(requested / PUBLIC_REVIEW_LIMIT));
  return Math.min(MAX_PUBLIC_REVIEW_LIMIT, pages * PUBLIC_REVIEW_LIMIT);
}

/**
 * The cafe's public answer under a review — one per review, written, edited or
 * taken down by staff with `reviews.moderate`. Guests see it signed by the cafe;
 * who on the team wrote it stays in the dashboard.
 */
export type ReviewReply = {
  text: string;
  /** The staff member who wrote (or last edited) it. */
  byName: string;
  /** When it was first posted — ISO 8601 (UTC). */
  at: string;
  /** When it was last edited, if it was. */
  updatedAt?: string;
};

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
  /** The cafe's reply, when staff wrote one. */
  reply?: ReviewReply;
  createdAt: string;
  updatedAt: string;
};

/**
 * A review as the public sees it: no account id, no moderation trail, and the
 * cafe's reply without the name of whoever on the team wrote it.
 */
export type PublicReview = Pick<ProductReview, "id" | "authorName" | "rating" | "comment" | "createdAt"> & {
  reply?: { text: string; at: string };
};

export function toPublicReview(review: ProductReview): PublicReview {
  return {
    id: review.id,
    authorName: review.authorName,
    rating: review.rating,
    comment: review.comment,
    createdAt: review.createdAt,
    ...(review.reply ? { reply: { text: review.reply.text, at: review.reply.updatedAt ?? review.reply.at } } : {}),
  };
}

/** One page of an item's approved reviews, newest first, and how many there are in all. */
export type PublicReviewPage = { items: PublicReview[]; total: number };

/** A star rating the moderation queue can filter by. */
export const REVIEW_RATINGS = [5, 4, 3, 2, 1] as const;

/** An item that has reviews, for the moderation queue's item filter. */
export type ReviewedProduct = { productId: string; productName: string };

/** Whether a guest may review an item, and their review if they already wrote one. */
export type ReviewEligibility = {
  /** They have a completed order containing the item. */
  canReview: boolean;
  review: ProductReview | null;
};

/** An average of stars to one decimal, and how many reviews it comes from. */
export type RatingSummary = { rating: number; ratingCount: number };

/** An item's rating from its approved reviews' stars: the average to one decimal, and how many. */
export function ratingSummary(ratings: readonly number[]): RatingSummary {
  return ratingFromTotals(
    ratings.reduce((sum, value) => sum + value, 0),
    ratings.length,
  );
}

/** The same rating from stars already added up — what a database sum hands back. */
export function ratingFromTotals(sum: number, count: number): RatingSummary {
  if (count === 0) return { rating: 0, ratingCount: 0 };
  return { rating: Math.round((sum / count) * 10) / 10, ratingCount: count };
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
