import type { AuditHook } from "./AuditHook";
import type { ModerationStatus, ProductReview, ReviewStatus } from "../entities/ProductReview";

/** A guest's review as they wrote it. Status, moderation and timestamps are the repository's. */
export type ReviewDraft = Pick<ProductReview, "productId" | "productName" | "userId" | "authorName" | "rating" | "comment">;

/** Which reviews the moderation queue shows. */
export const REVIEW_VIEWS = ["pending", "approved", "rejected", "all"] as const;
export type ReviewView = (typeof REVIEW_VIEWS)[number];

export type ReviewFilters = {
  view: ReviewView;
  /** Matches the item's name, the author or the words. */
  q?: string;
};

export type IReviewRepository = {
  /**
   * Save the guest's review of an item — their first, or a rewrite of the one they
   * have. Either way it's `pending` until staff look at it, and the item's rating is
   * recomputed in the same transaction (a rewritten approved review leaves it).
   */
  saveOwn(draft: ReviewDraft): Promise<ProductReview>;
  getById(id: string): Promise<ProductReview | null>;
  getOwn(productId: string, userId: string): Promise<ProductReview | null>;
  /** An item's approved reviews, newest first. */
  listApproved(productId: string, limit: number): Promise<ProductReview[]>;
  /** The moderation queue: `pending` oldest first (first come, first served), the rest newest first. */
  list(filters: ReviewFilters): Promise<ProductReview[]>;
  countByStatus(): Promise<Record<ReviewStatus, number>>;
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
};
