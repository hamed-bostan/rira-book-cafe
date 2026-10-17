import type { ModerateReviewInput } from "@/src/contracts/review-schema";
import type { ProductReview } from "@/src/domain/entities/ProductReview";
import { apiPatch } from "@/src/lib/api/client";
import { reviewResponseSchema } from "@/src/presentation/reviews/review-response-schema";

/** Typed client for review moderation; components `router.refresh()` after. */
export const reviewsApi = {
  /** Approve or reject. 409 when it changed in the meantime. */
  moderate(id: string, values: ModerateReviewInput): Promise<ProductReview> {
    return apiPatch(`/admin/reviews/${id}`, values, reviewResponseSchema);
  },
};
