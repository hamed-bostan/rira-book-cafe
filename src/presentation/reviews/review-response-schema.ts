import { z } from "zod";

import { REVIEW_STATUSES, type ProductReview, type PublicReview, type ReviewEligibility, type ReviewStatus } from "@/src/domain/entities/ProductReview";

/** What the review endpoints return, validated at the typed-service boundary. */
export const reviewResponseSchema = z.object({
  id: z.string(),
  productId: z.string(),
  productName: z.string(),
  userId: z.string(),
  authorName: z.string(),
  rating: z.number(),
  comment: z.string().optional(),
  status: z.enum(REVIEW_STATUSES),
  moderatedByName: z.string().optional(),
  moderatedAt: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
}) satisfies z.ZodType<ProductReview>;

export const reviewListResponseSchema = z.array(reviewResponseSchema);

export const publicReviewListResponseSchema = z.array(
  z.object({
    id: z.string(),
    authorName: z.string(),
    rating: z.number(),
    comment: z.string().optional(),
    createdAt: z.string(),
  }) satisfies z.ZodType<PublicReview>,
);

export const reviewEligibilityResponseSchema = z.object({
  canReview: z.boolean(),
  review: reviewResponseSchema.nullable(),
}) satisfies z.ZodType<ReviewEligibility>;

export const reviewCountsResponseSchema = z.object({
  pending: z.number(),
  approved: z.number(),
  rejected: z.number(),
}) satisfies z.ZodType<Record<ReviewStatus, number>>;
