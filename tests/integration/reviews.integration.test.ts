import { revalidateTag } from "next/cache";
import { describe, expect, it, vi } from "vitest";

import { PATCH as moderateReview } from "@/app/api/admin/reviews/[id]/route";
import { POST as placeOrder } from "@/app/api/orders/route";
import { PUT as writeReview } from "@/app/api/products/[id]/reviews/mine/route";
import type { Order } from "@/src/domain/entities/Order";
import type { ProductReview } from "@/src/domain/entities/ProductReview";
import { prisma } from "@/src/infrastructure/prisma/client";
import { CATALOG_TAGS } from "@/src/lib/cache-tags";

import { jsonRequest, readError, readJson, routeParams } from "./helpers/http";
import { signInAs } from "./helpers/session";

const ITEM = "seed-espresso";

/** The test guest has had the item: an order of it, completed. */
async function guestHasHadItem(): Promise<void> {
  signInAs("customer");
  const response = await placeOrder(
    jsonRequest("POST", "/api/orders", { items: [{ productId: ITEM, quantity: 1 }], serviceType: "takeaway" }),
  );
  expect(response.status).toBe(201);
  const order = await readJson<Order>(response);
  await prisma.order.update({ where: { id: order.id }, data: { status: "completed" } });
}

function write(rating: number): Promise<Response> {
  return writeReview(jsonRequest("PUT", `/api/products/${ITEM}/reviews/mine`, { rating }), routeParams({ id: ITEM }));
}

async function ratingOf(productId: string): Promise<{ rating: number; ratingCount: number }> {
  return prisma.product.findUniqueOrThrow({ where: { id: productId }, select: { rating: true, ratingCount: true } });
}

describe("a guest's own review", () => {
  it("expires the cached catalog when a rewrite takes approved stars out of the rating", async () => {
    await guestHasHadItem();
    const before = await ratingOf(ITEM);

    const first = await write(5);
    expect(first.status).toBe(200);
    const review = await readJson<ProductReview>(first);

    signInAs("admin");
    const approved = await moderateReview(
      jsonRequest("PATCH", `/api/admin/reviews/${review.id}`, { status: "approved" }),
      routeParams({ id: review.id }),
    );
    expect(approved.status).toBe(200);
    expect((await ratingOf(ITEM)).ratingCount).toBe(before.ratingCount + 1);

    // The rewrite goes back to the queue, so its stars leave the item's rating — and
    // the storefront's cached menu must expire with it, as it does on moderation.
    signInAs("customer");
    vi.mocked(revalidateTag).mockClear();
    const rewritten = await write(1);
    expect(rewritten.status).toBe(200);
    expect(await ratingOf(ITEM)).toEqual(before);
    expect(revalidateTag).toHaveBeenCalledWith(CATALOG_TAGS.products, { expire: 0 });
  });

  it("leaves the cache alone when the write is refused", async () => {
    signInAs("customer");
    const response = await write(4);

    expect(response.status).toBe(409);
    expect((await readError(response)).code).toBe("NOT_PURCHASED");
    expect(revalidateTag).not.toHaveBeenCalled();
  });
});
