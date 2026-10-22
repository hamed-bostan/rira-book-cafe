import { describe, expect, it, vi } from "vitest";

import { PUBLIC_REVIEW_LIMIT, type ProductReview } from "../../../entities/ProductReview";
import {
  CountReviews,
  GetApprovedRating,
  GetReviewEligibility,
  ListProductReviews,
  ListReviews,
} from "../ReviewQueries";

import type { IReviewRepository } from "../../../repositories/IReviewRepository";

function review(overrides: Partial<ProductReview> = {}): ProductReview {
  return {
    id: "r1",
    productId: "p1",
    productName: "Latte",
    userId: "g1",
    authorName: "Sara",
    rating: 5,
    comment: "Lovely",
    status: "approved",
    moderatedByName: "Ali",
    moderatedAt: "2026-10-20T10:00:00Z",
    createdAt: "2026-10-19T10:00:00Z",
    updatedAt: "2026-10-20T10:00:00Z",
    ...overrides,
  };
}

type Fake = {
  repo: IReviewRepository;
  listApproved: ReturnType<typeof vi.fn<IReviewRepository["listApproved"]>>;
  list: ReturnType<typeof vi.fn<IReviewRepository["list"]>>;
};

function reviews(options: { purchased?: boolean; own?: ProductReview | null } = {}): Fake {
  const listApproved = vi.fn<IReviewRepository["listApproved"]>(async () => [review()]);
  const list = vi.fn<IReviewRepository["list"]>(async () => [review({ status: "pending" })]);
  const repo = {
    listApproved,
    list,
    hasPurchased: vi.fn(async () => options.purchased ?? false),
    getOwn: vi.fn(async () => options.own ?? null),
    countByStatus: vi.fn(async () => ({ pending: 2, approved: 5, rejected: 1 })),
  } as unknown as IReviewRepository;
  return { repo, listApproved, list };
}

describe("ListProductReviews", () => {
  it("shows the public only the author's first name, stars, words and date", async () => {
    const { repo, listApproved } = reviews();
    const shown = await new ListProductReviews(repo).execute("p1");
    expect(listApproved).toHaveBeenCalledWith("p1", PUBLIC_REVIEW_LIMIT);
    expect(shown).toEqual([
      { id: "r1", authorName: "Sara", rating: 5, comment: "Lovely", createdAt: "2026-10-19T10:00:00Z" },
    ]);
  });
});

describe("GetReviewEligibility", () => {
  it("combines whether they had it with the review they already wrote", async () => {
    const own = review({ status: "pending" });
    expect(await new GetReviewEligibility(reviews({ purchased: true, own }).repo).execute("p1", "g1")).toEqual({
      canReview: true,
      review: own,
    });
    expect(await new GetReviewEligibility(reviews().repo).execute("p1", "g1")).toEqual({
      canReview: false,
      review: null,
    });
  });
});

describe("ListReviews / CountReviews", () => {
  it.each<[string | undefined, string | undefined]>([
    ["  latte ", "latte"],
    ["   ", undefined],
    [undefined, undefined],
  ])("trims the search %j", async (q, expected) => {
    const { repo, list } = reviews();
    await new ListReviews(repo).execute({ view: "pending", q });
    expect(list).toHaveBeenCalledWith({ view: "pending", q: expected });
  });

  it("counts the queue's tabs", async () => {
    expect(await new CountReviews(reviews().repo).execute()).toEqual({ pending: 2, approved: 5, rejected: 1 });
  });
});

describe("GetApprovedRating", () => {
  function rated(sum: number, count: number): IReviewRepository {
    return { approvedRatingTotals: vi.fn(async () => ({ sum, count })) } as unknown as IReviewRepository;
  }

  it("averages the approved stars to one decimal", async () => {
    expect(await new GetApprovedRating(rated(23, 5)).execute()).toEqual({ rating: 4.6, ratingCount: 5 });
    expect(await new GetApprovedRating(rated(13, 3)).execute()).toEqual({ rating: 4.3, ratingCount: 3 });
  });

  it("reads as no rating when nothing is approved", async () => {
    expect(await new GetApprovedRating(rated(0, 0)).execute()).toEqual({ rating: 0, ratingCount: 0 });
  });
});
