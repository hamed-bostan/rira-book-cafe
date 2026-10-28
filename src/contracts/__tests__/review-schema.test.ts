import { describe, expect, it } from "vitest";

import { MAX_REVIEW_COMMENT_LENGTH, MAX_REVIEW_RATING, MIN_REVIEW_RATING } from "@/src/domain/entities/ProductReview";

import { moderateReviewSchema, submitReviewSchema } from "../review-schema";

import { flattened } from "./zod-issues";

describe("submitReviewSchema", () => {
  it("trims the comment and turns blank or absent into undefined", () => {
    expect(submitReviewSchema.parse({ rating: 5, comment: " Lovely crema " })).toEqual({
      rating: 5,
      comment: "Lovely crema",
    });
    expect(submitReviewSchema.parse({ rating: 1 })).toEqual({ rating: 1, comment: undefined });
    expect(submitReviewSchema.parse({ rating: 3, comment: "  " }).comment).toBeUndefined();
  });

  it("only takes a whole rating in range", () => {
    for (const rating of [MIN_REVIEW_RATING - 1, MAX_REVIEW_RATING + 1, 4.5]) {
      expect(flattened(submitReviewSchema.safeParse({ rating }).error)?.fieldErrors.rating).toEqual(["ratingInvalid"]);
    }
  });

  it("caps the comment", () => {
    expect(
      flattened(submitReviewSchema.safeParse({ rating: 4, comment: "c".repeat(MAX_REVIEW_COMMENT_LENGTH + 1) }).error)
        ?.fieldErrors.comment,
    ).toEqual(["commentTooLong"]);
  });
});

describe("moderateReviewSchema", () => {
  it("approves or rejects, never sets pending", () => {
    expect(moderateReviewSchema.parse({ status: "approved" })).toEqual({ status: "approved" });
    expect(moderateReviewSchema.parse({ status: "rejected" })).toEqual({ status: "rejected" });
    expect(flattened(moderateReviewSchema.safeParse({ status: "pending" }).error)?.fieldErrors.status).toEqual([
      "statusInvalid",
    ]);
  });
});
