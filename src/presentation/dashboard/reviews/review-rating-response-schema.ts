import { z } from "zod";

import type { RatingSummary } from "@/src/domain/entities/ProductReview";

/** What GET /api/admin/reviews/rating returns, checked at the BFF boundary. */
export const reviewRatingResponseSchema = z.object({
  rating: z.number(),
  ratingCount: z.number(),
}) satisfies z.ZodType<RatingSummary>;
