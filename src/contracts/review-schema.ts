import {
  MAX_REVIEW_COMMENT_LENGTH,
  MAX_REVIEW_RATING,
  MIN_REVIEW_RATING,
  MODERATION_STATUSES,
} from "@/src/domain/entities/ProductReview";
import * as z from "@/src/lib/zod";

/**
 * Review contracts shared by the route handlers and the forms that call them.
 * Messages are `formErrors` keys.
 */

/** A guest reviewing an item they had. */
export const submitReviewSchema = z.object({
  rating: z
    .number()
    .check(
      z.int("ratingInvalid"),
      z.gte(MIN_REVIEW_RATING, "ratingInvalid"),
      z.lte(MAX_REVIEW_RATING, "ratingInvalid"),
    ),
  comment: z.pipe(
    z.optional(z.string().check(z.trim(), z.maxLength(MAX_REVIEW_COMMENT_LENGTH, "commentTooLong"))),
    z.transform((value) => (value ? value : undefined)),
  ),
});

export type SubmitReviewInput = z.input<typeof submitReviewSchema>;

/** Staff approving or rejecting a review. */
export const moderateReviewSchema = z.object({
  status: z.enum(MODERATION_STATUSES, { error: "statusInvalid" }),
});

export type ModerateReviewInput = z.input<typeof moderateReviewSchema>;
