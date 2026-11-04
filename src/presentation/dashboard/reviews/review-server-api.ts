import type { Page } from "@/src/domain/entities/Pagination";
import type { ProductReview, RatingSummary, ReviewedProduct, ReviewStatus } from "@/src/domain/entities/ProductReview";
import { serverApiGet } from "@/src/lib/api/server-client";
import {
  reviewCountsResponseSchema,
  reviewedProductListResponseSchema,
  reviewPageResponseSchema,
} from "@/src/presentation/reviews/review-response-schema";

import { reviewRatingResponseSchema } from "./review-rating-response-schema";

/** The query params the moderation queue's list understands. */
const LIST_PARAMS = ["view", "q", "productId", "rating", "page", "pageSize"] as const;

/** Server-side review reads for the dashboard (BFF), fetched during server render. */
export const reviewsServerApi = {
  /**
   * One page of the queue for the URL the screen was rendered with — tab, search,
   * item, stars and paging pass through as they are; the route parses them back.
   */
  list(params: URLSearchParams): Promise<Page<ProductReview>> {
    const forwarded: Record<string, string> = {};
    for (const name of LIST_PARAMS) {
      const value = params.get(name);
      if (value) forwarded[name] = value;
    }
    return serverApiGet("/admin/reviews", reviewPageResponseSchema, { params: forwarded });
  },

  /** The items that have reviews, for the item filter. */
  reviewedProducts(): Promise<ReviewedProduct[]> {
    return serverApiGet("/admin/reviews/products", reviewedProductListResponseSchema);
  },

  counts(): Promise<Record<ReviewStatus, number>> {
    return serverApiGet("/admin/reviews/counts", reviewCountsResponseSchema);
  },

  /** The average stars across every approved review, and how many. */
  getRating(): Promise<RatingSummary> {
    return serverApiGet("/admin/reviews/rating", reviewRatingResponseSchema);
  },
};
