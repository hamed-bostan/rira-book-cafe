import { z } from "zod";

import { MAX_REVIEW_COMMENT_LENGTH, MAX_REVIEW_RATING, MIN_REVIEW_RATING, MODERATION_STATUSES } from "@/src/domain/entities/ProductReview";

/**
 * Review contracts shared by the route handlers and the forms that call them.
 * Messages are `formErrors` keys.
 */

/** A guest reviewing an item they had. */
export const submitReviewSchema = z.object({
  rating: z.number().int("ratingInvalid").min(MIN_REVIEW_RATING, "ratingInvalid").max(MAX_REVIEW_RATING, "ratingInvalid"),
  comment: z
    .string()
    .trim()
    .max(MAX_REVIEW_COMMENT_LENGTH, "commentTooLong")
    .optional()
    .transform((value) => (value ? value : undefined)),
});

export type SubmitReviewInput = z.input<typeof submitReviewSchema>;

/** Staff approving or rejecting a review. */
export const moderateReviewSchema = z.object({
  status: z.enum(MODERATION_STATUSES, { message: "statusInvalid" }),
});

export type ModerateReviewInput = z.input<typeof moderateReviewSchema>;
