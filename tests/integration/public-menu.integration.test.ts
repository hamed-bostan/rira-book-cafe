import { describe, expect, it } from "vitest";

import { POST as lend } from "@/app/api/admin/book-loans/route";
import { PATCH as bulkUpdateCategories } from "@/app/api/admin/categories/bulk/route";
import { POST as ringUpSale } from "@/app/api/admin/orders/route";
import { POST as quoteOrder } from "@/app/api/orders/quote/route";
import { POST as placeOrder } from "@/app/api/orders/route";
import { PUT as writeReview } from "@/app/api/products/[id]/reviews/mine/route";
import { GET as getProduct } from "@/app/api/products/[id]/route";
import { GET as listProducts } from "@/app/api/products/route";
import { cafeDayOf, shiftCafeDay } from "@/src/domain/entities/CafeTime";
import type { Order } from "@/src/domain/entities/Order";
import type { Product } from "@/src/domain/entities/Product";
import { prisma } from "@/src/infrastructure/prisma/client";

import { getRequest, jsonRequest, readError, readJson, routeParams } from "./helpers/http";
import { signInAs } from "./helpers/session";

/** A hot drink, on the menu until its category is hidden. */
const ESPRESSO = "seed-espresso";
/** A book on the lending shelf. */
const BLIND_OWL = "seed-book-blind-owl";

const takeaway = { items: [{ productId: ESPRESSO, quantity: 1 }], serviceType: "takeaway" };

/** Hide a category the way staff do, from the categories list. */
async function hideCategory(slug: string): Promise<void> {
  const category = await prisma.category.findUniqueOrThrow({ where: { slug } });
  signInAs("admin");
  const response = await bulkUpdateCategories(
    jsonRequest("PATCH", "/api/admin/categories/bulk", { ids: [category.id], action: { type: "deactivate" } }),
  );
  expect(response.status).toBe(200);
  signInAs(null);
}

async function listedIds(query = ""): Promise<string[]> {
  const response = await listProducts(getRequest(`/api/products${query}`));
  expect(response.status).toBe(200);
  return (await readJson<Product[]>(response)).map((product) => product.id);
}

describe("an item in a hidden category", () => {
  it("is on every public read until the category is hidden", async () => {
    expect(await listedIds()).toContain(ESPRESSO);
    expect(await listedIds("?q=espresso")).toContain(ESPRESSO);
    expect((await getProduct(getRequest(`/api/products/${ESPRESSO}`), routeParams({ id: ESPRESSO }))).status).toBe(200);
  });

  it("drops off the menu, search, featured and id lookups for guests, and its page is not found", async () => {
    await prisma.product.update({ where: { id: ESPRESSO }, data: { isFeatured: true } });
    expect(await listedIds("?featured=true")).toContain(ESPRESSO);
    await hideCategory("hot-drinks");

    expect(await listedIds()).not.toContain(ESPRESSO);
    expect(await listedIds("?featured=true")).not.toContain(ESPRESSO);
    expect(await listedIds("?q=espresso")).not.toContain(ESPRESSO);
    expect(await listedIds(`?ids=${ESPRESSO}`)).toEqual([]);

    const page = await getProduct(getRequest(`/api/products/${ESPRESSO}`), routeParams({ id: ESPRESSO }));
    expect(page.status).toBe(404);
    expect((await readError(page)).code).toBe("NOT_FOUND");

    // Staff labelling an order's lines still see it — and the item keeps its own switch.
    signInAs("staff");
    expect(await listedIds(`?ids=${ESPRESSO}`)).toEqual([ESPRESSO]);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: ESPRESSO } })).isPublished).toBe(true);
  });

  it("can't be quoted or ordered by a guest, nor rung up at the counter", async () => {
    await hideCategory("hot-drinks");

    signInAs("customer");
    for (const response of [
      await quoteOrder(jsonRequest("POST", "/api/orders/quote", { items: takeaway.items })),
      await placeOrder(jsonRequest("POST", "/api/orders", takeaway)),
    ]) {
      expect(response.status).toBe(400);
      expect((await readError(response)).fieldErrors).toEqual({ items: "One of the items is no longer on the menu." });
    }

    signInAs("staff");
    const sale = await ringUpSale(
      jsonRequest("POST", "/api/admin/orders", { ...takeaway, customerPhone: "0912 555 0140", customerName: "Nima" }),
    );
    expect(sale.status).toBe(400);
    expect((await readError(sale)).fieldErrors).toEqual({ items: "One of the items is no longer on the menu." });
    expect(await prisma.order.count({ where: { items: { some: { productId: ESPRESSO } } } })).toBe(0);
  });

  it("can't be reviewed, even by a guest who had it", async () => {
    signInAs("customer");
    const placed = await placeOrder(jsonRequest("POST", "/api/orders", takeaway));
    expect(placed.status).toBe(201);
    const order = await readJson<Order>(placed);
    await prisma.order.update({ where: { id: order.id }, data: { status: "completed" } });
    await hideCategory("hot-drinks");

    signInAs("customer");
    const review = await writeReview(
      jsonRequest("PUT", `/api/products/${ESPRESSO}/reviews/mine`, { rating: 5 }),
      routeParams({ id: ESPRESSO }),
    );
    expect(review.status).toBe(404);
    expect(await prisma.productReview.count({ where: { productId: ESPRESSO } })).toBe(0);
  });

  it("is still a book staff can lend — lending isn't a sale", async () => {
    await hideCategory("books");

    signInAs("staff");
    const response = await lend(
      jsonRequest("POST", "/api/admin/book-loans", {
        productId: BLIND_OWL,
        borrowerName: "Sara",
        borrowerPhone: "0912 555 0141",
        dueOn: shiftCafeDay(cafeDayOf(new Date()), 14),
        note: "",
      }),
    );
    expect(response.status).toBe(201);
  });
});
