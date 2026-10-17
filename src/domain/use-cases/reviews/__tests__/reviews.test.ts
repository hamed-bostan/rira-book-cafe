import { describe, expect, it, vi } from "vitest";

import { ratingSummary, reviewAuthorName, type ProductReview } from "../../../entities/ProductReview";
import { ConflictError } from "../../../errors/ConflictError";
import { ValidationError } from "../../../errors/ValidationError";
import { ModerateReview, SubmitReview } from "../ReviewCommands";

import type { Product } from "../../../entities/Product";
import type { ICustomerNotifier } from "../../../repositories/INotificationRepository";
import type { IReviewRepository } from "../../../repositories/IReviewRepository";

const NOW = new Date("2026-10-20T10:00:00Z");

function review(overrides: Partial<ProductReview> = {}): ProductReview {
  return {
    id: "r1",
    productId: "p1",
    productName: "Latte",
    userId: "g1",
    authorName: "Sara",
    rating: 4,
    status: "pending",
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...overrides,
  };
}

function reviewRepo(purchased: boolean, current: ProductReview | null = null) {
  return {
    hasPurchased: vi.fn(async () => purchased),
    saveOwn: vi.fn(async (draft: Parameters<IReviewRepository["saveOwn"]>[0]) => review({ ...draft })),
    getById: vi.fn(async () => current),
    moderate: vi.fn(async (_id: string, _expected: string, status: "approved" | "rejected") => review({ ...current, status })),
  } as unknown as IReviewRepository & { saveOwn: ReturnType<typeof vi.fn>; moderate: ReturnType<typeof vi.fn> };
}

const products = { getPublishedById: vi.fn(async () => ({ id: "p1", name: "Latte" }) as Product) };

describe("SubmitReview", () => {
  it("lets a guest who had the item review it, under their first name", async () => {
    const repo = reviewRepo(true);
    await new SubmitReview(repo, products).execute("p1", { rating: 5, comment: "  lovely " }, { id: "g1", name: "Sara Ahmadi" });
    expect(repo.saveOwn).toHaveBeenCalledWith({ productId: "p1", productName: "Latte", userId: "g1", authorName: "Sara", rating: 5, comment: "lovely" });
  });

  it("refuses a guest who hasn't had it, and a rating outside 1–5", async () => {
    await expect(new SubmitReview(reviewRepo(false), products).execute("p1", { rating: 5 }, { id: "g1", name: "Sara" })).rejects.toBeInstanceOf(
      ConflictError,
    );
    await expect(new SubmitReview(reviewRepo(true), products).execute("p1", { rating: 6 }, { id: "g1", name: "Sara" })).rejects.toBeInstanceOf(
      ValidationError,
    );
  });
});

describe("ModerateReview", () => {
  it("approves, records who did it, and tells the guest", async () => {
    const repo = reviewRepo(true, review());
    const notifier: ICustomerNotifier = { notify: vi.fn(async () => undefined) };
    const saved = await new ModerateReview(repo, notifier).execute("r1", "approved", { id: "s1", name: "Ali" }, NOW);
    expect(saved.status).toBe("approved");
    expect(repo.moderate.mock.calls[0][1]).toBe("pending");
    expect(notifier.notify).toHaveBeenCalledWith(expect.objectContaining({ userId: "g1", kind: "reviewApproved" }));
  });

  it("changes nothing when the review already has that status", async () => {
    const repo = reviewRepo(true, review({ status: "rejected" }));
    await new ModerateReview(repo).execute("r1", "rejected", { id: "s1", name: "Ali" }, NOW);
    expect(repo.moderate).not.toHaveBeenCalled();
  });
});

describe("ratingSummary / reviewAuthorName", () => {
  it("averages approved stars to one decimal", () => {
    expect(ratingSummary([5, 4, 4])).toEqual({ rating: 4.3, ratingCount: 3 });
    expect(ratingSummary([])).toEqual({ rating: 0, ratingCount: 0 });
  });

  it("shows a first name, and nothing for the placeholder name", () => {
    expect(reviewAuthorName("  Sara Ahmadi ", "Rira Guest")).toBe("Sara");
    expect(reviewAuthorName("Rira Guest", "Rira Guest")).toBe("");
  });
});
