import type { AuditHook } from "./AuditHook";
import type { Page, PageRequest } from "../entities/Pagination";
import type { ModerationStatus, ProductReview, ReviewedProduct, ReviewStatus } from "../entities/ProductReview";

/** A guest's review as they wrote it. Status, moderation and timestamps are the repository's. */
export type ReviewDraft = Pick<
  ProductReview,
  "productId" | "productName" | "userId" | "authorName" | "rating" | "comment"
>;

/** Which reviews the moderation queue shows. */
export const REVIEW_VIEWS = ["pending", "approved", "rejected", "all"] as const;
export type ReviewView = (typeof REVIEW_VIEWS)[number];

export type ReviewFilters = {
  view: ReviewView;
  /** Matches the item's name, the author or the words. */
  q?: string;
  /** Only the reviews of this item. */
  productId?: string;
  /** Only the reviews with this many stars. */
  rating?: number;
};

/** The cafe's reply as staff post it: the words, who wrote them, and when. */
export type ReviewReplyInput = {
  text: string;
  by: { id: string; name: string };
  at: Date;
};

export type IReviewRepository = {
  /**
   * Save the guest's review of an item — their first, or a rewrite of the one they
   * have. Either way it's `pending` until staff look at it, and the item's rating is
   * recomputed in the same transaction (a rewritten approved review leaves it).
   * A reply the cafe wrote stays with the rewrite.
   */
  saveOwn(draft: ReviewDraft): Promise<ProductReview>;
  getById(id: string): Promise<ProductReview | null>;
  getOwn(productId: string, userId: string): Promise<ProductReview | null>;
  /** An item's approved reviews, newest first, at most `limit`. */
  listApproved(productId: string, limit: number): Promise<ProductReview[]>;
  /** How many approved reviews an item has. */
  countApproved(productId: string): Promise<number>;
  /** One page of the moderation queue, newest first in every view — what just came in is what's read first. */
  list(filters: ReviewFilters, page: PageRequest): Promise<Page<ProductReview>>;
  /** The items that have any reviews, by name — the queue's item filter. */
  listReviewedProducts(): Promise<ReviewedProduct[]>;
  countByStatus(): Promise<Record<ReviewStatus, number>>;
  /** Every approved review's stars added up, and how many there are — the cafe's rating as guests see it. */
  approvedRatingTotals(): Promise<{ sum: number; count: number }>;
  /** Whether the guest has a completed order containing the item. */
  hasPurchased(userId: string, productId: string): Promise<boolean>;
  /**
   * Approve or reject, guarded on `expectedStatus` so a concurrent change can't be
   * overwritten (`ConflictError("INVALID_TRANSITION")`). The item's rating is
   * recomputed from its approved reviews in the same transaction.
   */
  moderate(
    id: string,
    expectedStatus: ReviewStatus,
    status: ModerationStatus,
    moderator: { id: string; name: string },
    at: Date,
    audit?: AuditHook<ProductReview>,
  ): Promise<ProductReview>;
  /**
   * Post, edit (`reply`) or take down (`null`) the cafe's one reply under a
   * review. Posting keeps the first `at`; an edit records `updatedAt`. `audit`
   * commits with it. `NotFoundError` when the review is gone.
   */
  setReply(id: string, reply: ReviewReplyInput | null, audit?: AuditHook<ProductReview>): Promise<ProductReview>;
  /**
   * Delete a review and recompute its item's rating in the same transaction;
   * `audit` (staff deleting) commits with it. Returns the review as it was, or
   * `null` when it was already gone.
   */
  delete(id: string, audit?: AuditHook<ProductReview>): Promise<ProductReview | null>;
};
