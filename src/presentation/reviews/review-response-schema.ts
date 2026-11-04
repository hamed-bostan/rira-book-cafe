import { z } from "zod/mini";

import type { Page } from "@/src/domain/entities/Pagination";
import {
  REVIEW_STATUSES,
  type ProductReview,
  type PublicReview,
  type PublicReviewPage,
  type ReviewedProduct,
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
  reply: z.optional(
    z.object({
      text: z.string(),
      byName: z.string(),
      at: z.string(),
      updatedAt: z.optional(z.string()),
    }),
  ),
  createdAt: z.string(),
  updatedAt: z.string(),
}) satisfies z.ZodMiniType<ProductReview>;

/** One page of the moderation queue. */
export const reviewPageResponseSchema = z.object({
  items: z.array(reviewResponseSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
}) satisfies z.ZodMiniType<Page<ProductReview>>;

/** The items that have reviews — the queue's item filter. */
export const reviewedProductListResponseSchema = z.array(
  z.object({ productId: z.string(), productName: z.string() }) satisfies z.ZodMiniType<ReviewedProduct>,
);

const publicReviewResponseSchema = z.object({
  id: z.string(),
  authorName: z.string(),
  rating: z.number(),
  comment: z.optional(z.string()),
  createdAt: z.string(),
  reply: z.optional(z.object({ text: z.string(), at: z.string() })),
}) satisfies z.ZodMiniType<PublicReview>;

/** An item's approved reviews (the first page or more) and how many there are. */
export const publicReviewPageResponseSchema = z.object({
  items: z.array(publicReviewResponseSchema),
  total: z.number(),
}) satisfies z.ZodMiniType<PublicReviewPage>;

export const reviewEligibilityResponseSchema = z.object({
  canReview: z.boolean(),
  review: z.nullable(reviewResponseSchema),
}) satisfies z.ZodMiniType<ReviewEligibility>;

export const reviewCountsResponseSchema = z.object({
  pending: z.number(),
  approved: z.number(),
  rejected: z.number(),
}) satisfies z.ZodMiniType<Record<ReviewStatus, number>>;
