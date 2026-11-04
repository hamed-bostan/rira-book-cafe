import { describe, expect, it, vi } from "vitest";

import {
  MAX_PUBLIC_REVIEW_LIMIT,
  PUBLIC_REVIEW_LIMIT,
  publicReviewLimit,
  type ProductReview,
} from "../../../entities/ProductReview";
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
  const list = vi.fn<IReviewRepository["list"]>(async (_filters, page) => ({
    items: [review({ status: "pending" })],
    total: 1,
    page: page.page,
    pageSize: page.pageSize,
  }));
  const repo = {
    listApproved,
    countApproved: vi.fn(async () => 31),
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
    expect(shown).toEqual({
      items: [{ id: "r1", authorName: "Sara", rating: 5, comment: "Lovely", createdAt: "2026-10-19T10:00:00Z" }],
      total: 31,
    });
  });

  it("shows the cafe's reply without who on the team wrote it", async () => {
    const { repo, listApproved } = reviews();
    listApproved.mockResolvedValue([
      review({
        reply: { text: "Thank you!", byName: "Ali", at: "2026-10-21T10:00:00Z", updatedAt: "2026-10-22T10:00:00Z" },
      }),
    ]);
    const { items } = await new ListProductReviews(repo).execute("p1");
    expect(items[0].reply).toEqual({ text: "Thank you!", at: "2026-10-22T10:00:00Z" });
  });

  it('asks for more pages when "Show more" did, within the cap', async () => {
    const { repo, listApproved } = reviews();
    await new ListProductReviews(repo).execute("p1", 40);
    expect(listApproved).toHaveBeenLastCalledWith("p1", 40);
    await new ListProductReviews(repo).execute("p1", 100_000);
    expect(listApproved).toHaveBeenLastCalledWith("p1", MAX_PUBLIC_REVIEW_LIMIT);
  });
});

describe("publicReviewLimit", () => {
  it("rounds to whole pages and stays within bounds", () => {
    expect(publicReviewLimit(undefined)).toBe(PUBLIC_REVIEW_LIMIT);
    expect(publicReviewLimit(Number.NaN)).toBe(PUBLIC_REVIEW_LIMIT);
    expect(publicReviewLimit(-5)).toBe(PUBLIC_REVIEW_LIMIT);
    expect(publicReviewLimit(21)).toBe(40);
    expect(publicReviewLimit(1_000)).toBe(MAX_PUBLIC_REVIEW_LIMIT);
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
    await new ListReviews(repo).execute({ view: "pending", q }, { page: 1, pageSize: 25 });
    expect(list).toHaveBeenCalledWith(
      { view: "pending", q: expected, productId: undefined, rating: undefined },
      { page: 1, pageSize: 25 },
    );
  });

  it("filters by item and by stars, dropping a star count outside 1–5, and clamps the page", async () => {
    const { repo, list } = reviews();
    await new ListReviews(repo).execute({ view: "all", productId: " p1 ", rating: 2 }, { page: 0, pageSize: 1_000 });
    expect(list).toHaveBeenLastCalledWith(
      { view: "all", q: undefined, productId: "p1", rating: 2 },
      { page: 1, pageSize: 100 },
    );
    await new ListReviews(repo).execute({ view: "all", rating: 9 }, { page: 2, pageSize: 25 });
    expect(list.mock.lastCall?.[0].rating).toBeUndefined();
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
