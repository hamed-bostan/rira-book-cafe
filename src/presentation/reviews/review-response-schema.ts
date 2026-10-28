import { z } from "zod/mini";

import {
  REVIEW_STATUSES,
  type ProductReview,
  type PublicReview,
  type ReviewEligibility,
  type ReviewStatus,
} from "@/src/domain/entities/ProductReview";

/** What the review endpoints return, validated at the typed-service boundary. */
export const reviewResponseSchema = z.object({
  id: z.string(),
  productId: z.string(),
  productName: z.string(),
  userId: z.string(),
  authorName: z.string(),
  rating: z.number(),
  comment: z.optional(z.string()),
  status: z.enum(REVIEW_STATUSES),
  moderatedByName: z.optional(z.string()),
  moderatedAt: z.optional(z.string()),
  createdAt: z.string(),
  updatedAt: z.string(),
}) satisfies z.ZodMiniType<ProductReview>;

export const reviewListResponseSchema = z.array(reviewResponseSchema);

export const publicReviewListResponseSchema = z.array(
  z.object({
    id: z.string(),
    authorName: z.string(),
    rating: z.number(),
    comment: z.optional(z.string()),
    createdAt: z.string(),
  }) satisfies z.ZodMiniType<PublicReview>,
);

export const reviewEligibilityResponseSchema = z.object({
  canReview: z.boolean(),
  review: z.nullable(reviewResponseSchema),
}) satisfies z.ZodMiniType<ReviewEligibility>;

export const reviewCountsResponseSchema = z.object({
  pending: z.number(),
  approved: z.number(),
  rejected: z.number(),
}) satisfies z.ZodMiniType<Record<ReviewStatus, number>>;
