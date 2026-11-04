import type { ModerateReviewInput, ReviewReplyInput } from "@/src/contracts/review-schema";
import type { ProductReview } from "@/src/domain/entities/ProductReview";
import { apiDelete, apiPatch, apiPut } from "@/src/lib/api/client";
import { reviewResponseSchema } from "@/src/presentation/reviews/review-response-schema";

/** Typed client for review moderation; components `router.refresh()` after. */
export const reviewsApi = {
  /** Approve or reject. 409 when it changed in the meantime. */
  moderate(id: string, values: ModerateReviewInput): Promise<ProductReview> {
    return apiPatch(`/admin/reviews/${id}`, values, reviewResponseSchema);
  },

  /** Post or edit the cafe's reply under a review. 409 `REVIEW_NOT_APPROVED` for one guests can't see. */
  reply(id: string, values: ReviewReplyInput): Promise<ProductReview> {
    return apiPut(`/admin/reviews/${id}/reply`, values, reviewResponseSchema);
  },

  /** Take the cafe's reply down. */
  removeReply(id: string): Promise<void> {
    return apiDelete(`/admin/reviews/${id}/reply`);
  },

  /** Delete a review for good. */
  remove(id: string): Promise<void> {
    return apiDelete(`/admin/reviews/${id}`);
  },
};
