import type { ProductReview, ReviewStatus } from "@/src/domain/entities/ProductReview";
import type { ReviewView } from "@/src/domain/repositories/IReviewRepository";
import { serverApiGet } from "@/src/lib/api/server-client";
import { reviewCountsResponseSchema, reviewListResponseSchema } from "@/src/presentation/reviews/review-response-schema";

/** Server-side review reads for the dashboard (BFF), fetched during server render. */
export const reviewsServerApi = {
  list(view: ReviewView, q?: string): Promise<ProductReview[]> {
    return serverApiGet("/admin/reviews", reviewListResponseSchema, { params: q ? { view, q } : { view } });
  },

  counts(): Promise<Record<ReviewStatus, number>> {
    return serverApiGet("/admin/reviews/counts", reviewCountsResponseSchema);
  },
};
