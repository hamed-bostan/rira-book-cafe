import { describe, expect, it } from "vitest";

import { DELETE as removeReply, PUT as reply } from "@/app/api/admin/reviews/[id]/reply/route";
import { DELETE as deleteReview } from "@/app/api/admin/reviews/[id]/route";
import { GET as reviewedProducts } from "@/app/api/admin/reviews/products/route";
import { GET as listQueue } from "@/app/api/admin/reviews/route";
import { DELETE as deleteMine } from "@/app/api/products/[id]/reviews/mine/route";
import { GET as listPublic } from "@/app/api/products/[id]/reviews/route";
import type { Page } from "@/src/domain/entities/Pagination";
import type { ProductReview, PublicReviewPage } from "@/src/domain/entities/ProductReview";
import { prisma } from "@/src/infrastructure/prisma/client";

import { TEST_USERS } from "../fixtures/users";

import { getRequest, jsonRequest, readError, readJson, routeParams } from "./helpers/http";
import { signInAs } from "./helpers/session";

const ITEM = "seed-espresso";
const GUEST = TEST_USERS.customer.id;

/** A review as the guest would have written it, straight into the table. */
async function seedReview(
  overrides: Partial<{ userId: string; rating: number; status: string; productId: string; productName: string }> = {},
): Promise<string> {
  const row = await prisma.productReview.create({
    data: {
      productId: overrides.productId ?? ITEM,
      productName: overrides.productName ?? "Espresso",
      userId: overrides.userId ?? GUEST,
      authorName: "Test",
      rating: overrides.rating ?? 4,
      comment: "Nice",
      status: overrides.status ?? "approved",
    },
  });
  return row.id;
}

/** Recompute the item's stars the way the repository does after a write — for rows seeded directly. */
async function refreshRating(productId: string): Promise<void> {
  const approved = await prisma.productReview.findMany({ where: { productId, status: "approved" } });
  const count = approved.length;
  const rating = count ? Math.round((approved.reduce((s, r) => s + r.rating, 0) / count) * 10) / 10 : 0;
  await prisma.product.update({ where: { id: productId }, data: { rating, ratingCount: count } });
}

function putReply(id: string, text: string): Promise<Response> {
  return reply(jsonRequest("PUT", `/api/admin/reviews/${id}/reply`, { text }), routeParams({ id }));
}

async function publicReviews(query = ""): Promise<PublicReviewPage> {
  return readJson<PublicReviewPage>(
    await listPublic(getRequest(`/api/products/${ITEM}/reviews${query}`), routeParams({ id: ITEM })),
  );
}

describe("review replies", () => {
  it("posts a reply under a shown review, tells the guest once, and shows it publicly signed by the cafe", async () => {
    const id = await seedReview();
    signInAs("admin");

    const posted = await putReply(id, "Thank you — come again!");
    expect(posted.status).toBe(200);
    expect((await readJson<ProductReview>(posted)).reply).toMatchObject({ text: "Thank you — come again!" });

    const edited = await putReply(id, "Thank you!");
    expect(edited.status).toBe(200);
    expect(await prisma.notification.count({ where: { userId: GUEST, kind: "reviewReplied" } })).toBe(1);

    const shown = (await publicReviews()).items.find((review) => review.id === id);
    expect(shown?.reply).toMatchObject({ text: "Thank you!" });
    expect(JSON.stringify(shown)).not.toContain("byName");

    const entries = await prisma.activityEntry.findMany({ where: { entityId: id }, orderBy: { createdAt: "asc" } });
    expect(entries.map((entry) => entry.action)).toEqual(["review.replied", "review.replied"]);

    const removed = await removeReply(jsonRequest("DELETE", `/api/admin/reviews/${id}/reply`), routeParams({ id }));
    expect(removed.status).toBe(200);
    expect((await publicReviews()).items.find((review) => review.id === id)?.reply).toBeUndefined();
  });

  it("refuses a reply to a review guests can't see, and anyone without reviews.moderate", async () => {
    const id = await seedReview({ status: "pending" });
    signInAs("admin");
    const refused = await putReply(id, "Hello");
    expect(refused.status).toBe(409);
    expect((await readError(refused)).code).toBe("REVIEW_NOT_APPROVED");

    signInAs("customer");
    expect((await putReply(id, "Hello")).status).toBe(401);
  });
});

describe("deleting reviews", () => {
  it("lets staff delete a review, taking its stars out of the rating and logging it", async () => {
    const id = await seedReview({ rating: 1 });
    await refreshRating(ITEM);
    const before = await prisma.product.findUniqueOrThrow({ where: { id: ITEM } });

    signInAs("admin");
    const response = await deleteReview(jsonRequest("DELETE", `/api/admin/reviews/${id}`), routeParams({ id }));
    expect(response.status).toBe(204);
    const after = await prisma.product.findUniqueOrThrow({ where: { id: ITEM } });
    expect(after.ratingCount).toBe(before.ratingCount - 1);
    expect(await prisma.activityEntry.count({ where: { entityId: id, action: "review.deleted" } })).toBe(1);

    const again = await deleteReview(jsonRequest("DELETE", `/api/admin/reviews/${id}`), routeParams({ id }));
    expect(again.status).toBe(404);
  });

  it("lets a guest delete their own review", async () => {
    const id = await seedReview();
    await refreshRating(ITEM);
    signInAs("customer");

    const response = await deleteMine(
      jsonRequest("DELETE", `/api/products/${ITEM}/reviews/mine`),
      routeParams({ id: ITEM }),
    );
    expect(response.status).toBe(204);
    expect(await prisma.productReview.findUnique({ where: { id } })).toBeNull();
    expect((await prisma.product.findUniqueOrThrow({ where: { id: ITEM } })).ratingCount).toBe(
      await prisma.productReview.count({ where: { productId: ITEM, status: "approved" } }),
    );

    const again = await deleteMine(
      jsonRequest("DELETE", `/api/products/${ITEM}/reviews/mine`),
      routeParams({ id: ITEM }),
    );
    expect(again.status).toBe(404);
  });
});

describe("paging and filters", () => {
  /** Guests to hang reviews on — the table allows one review per guest per item. */
  async function guests(count: number): Promise<string[]> {
    const ids = Array.from({ length: count }, (_, i) => `0919${String(i).padStart(7, "0")}`);
    await prisma.user.createMany({ data: ids.map((id) => ({ id, phone: id, name: "Guest", role: "customer" })) });
    return ids;
  }

  it("pages the moderation queue and filters it by item and stars", async () => {
    const people = await guests(5);
    for (const [index, userId] of people.entries()) {
      await seedReview({ userId, rating: index < 3 ? 5 : 2 });
    }
    await seedReview({ userId: people[0], productId: "seed-latte", productName: "Latte", rating: 5 });

    signInAs("admin");
    const page = async (query: string): Promise<Page<ProductReview>> =>
      readJson<Page<ProductReview>>(await listQueue(getRequest(`/api/admin/reviews?${query}`)));

    const fives = await page(`view=all&productId=${ITEM}&rating=5&pageSize=2`);
    expect(fives.total).toBe(3);
    expect(fives.items).toHaveLength(2);
    expect(fives.items.every((review) => review.rating === 5 && review.productId === ITEM)).toBe(true);
    const second = await page(`view=all&productId=${ITEM}&rating=5&pageSize=2&page=2`);
    expect(second.items).toHaveLength(1);
    expect(second.items[0].id).not.toBe(fives.items[0].id);

    const products = await readJson<{ productId: string; productName: string }[]>(await reviewedProducts());
    expect(products.map((product) => product.productId)).toEqual(expect.arrayContaining([ITEM, "seed-latte"]));
  });

  it("shows the first page of an item's reviews publicly, and more on request", async () => {
    const people = await guests(25);
    for (const userId of people) await seedReview({ userId });

    const first = await publicReviews();
    expect(first.items).toHaveLength(20);
    expect(first.total).toBeGreaterThanOrEqual(25);

    const more = await publicReviews("?limit=40");
    expect(more.items.length).toBe(Math.min(40, more.total));
  });
});
