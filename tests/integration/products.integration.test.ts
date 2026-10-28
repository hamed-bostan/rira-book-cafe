import { revalidateTag } from "next/cache";
import { describe, expect, it } from "vitest";

import { GET as getAdminProduct } from "@/app/api/admin/products/[id]/route";
import { GET as listAdminProducts } from "@/app/api/admin/products/route";
import { DELETE as deleteProduct, GET as getProduct, PUT as updateProduct } from "@/app/api/products/[id]/route";
import { GET as listProducts, POST as createProduct } from "@/app/api/products/route";
import type { Product, ProductListItem } from "@/src/domain/entities/Product";
import { prisma } from "@/src/infrastructure/prisma/client";
import { CATALOG_TAGS } from "@/src/lib/cache-tags";

import { getRequest, jsonRequest, rawRequest, readError, readJson, routeParams } from "./helpers/http";
import { signInAs } from "./helpers/session";

/** A valid product form, as the dashboard sends it (strings for the numeric inputs). */
async function productForm(overrides: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
  const category = await prisma.category.findUniqueOrThrow({ where: { slug: "hot-drinks" } });
  return {
    kind: "drink",
    name: "Cortado",
    categoryId: category.id,
    price: "130000",
    originalPrice: "",
    costPrice: "",
    imageUrl: "/images/seed/espresso.svg",
    stockQuantity: "40",
    madeToOrder: false,
    isFeatured: false,
    isPublished: true,
    badge: "",
    unit: "",
    description: "Espresso cut with warm milk.",
    nutrition: "",
    origin: "",
    dietary: [],
    taxExempt: false,
    bookAuthor: "",
    bookIsbn: "",
    bookAvailability: "sale",
    faName: "کورتادو",
    faUnit: "",
    faDescription: "",
    faNutrition: "",
    faOrigin: "",
    ...overrides,
  };
}

describe("public product reads", () => {
  it("lists the published menu without cost prices", async () => {
    const response = await listProducts(getRequest("/api/products"));

    expect(response.status).toBe(200);
    const products = await readJson<Product[]>(response);
    expect(products.map((product) => product.id)).toContain("seed-espresso");
    expect(products.every((product) => !("costPrice" in product) || product.costPrice === undefined)).toBe(true);
  });

  it("serves the Persian name when asked for fa", async () => {
    const response = await getProduct(
      getRequest("/api/products/seed-espresso", { "accept-language": "fa" }),
      routeParams({ id: "seed-espresso" }),
    );

    expect(response.status).toBe(200);
    expect((await readJson<Product>(response)).name).toBe("اسپرسو");
  });

  it("answers 404 for an unknown product", async () => {
    const response = await getProduct(getRequest("/api/products/nope"), routeParams({ id: "nope" }));

    expect(response.status).toBe(404);
    expect((await readError(response)).code).toBe("NOT_FOUND");
  });

  it("hides an unpublished product from the public read but not from the dashboard", async () => {
    await prisma.product.update({ where: { id: "seed-espresso" }, data: { isPublished: false } });

    const publicRead = await getProduct(
      getRequest("/api/products/seed-espresso"),
      routeParams({ id: "seed-espresso" }),
    );
    expect(publicRead.status).toBe(404);

    signInAs("staff");
    const adminRead = await getAdminProduct(
      getRequest("/api/admin/products/seed-espresso"),
      routeParams({ id: "seed-espresso" }),
    );
    expect(adminRead.status).toBe(200);
  });
});

describe("product writes", () => {
  it("refuses an anonymous create with 401", async () => {
    const response = await createProduct(jsonRequest("POST", "/api/products", await productForm()));

    expect(response.status).toBe(401);
    expect((await readError(response)).code).toBe("UNAUTHORIZED");
  });

  it("refuses roles without catalog.write (customer, staff)", async () => {
    for (const role of ["customer", "staff"] as const) {
      signInAs(role);
      const response = await createProduct(jsonRequest("POST", "/api/products", await productForm()));
      expect(response.status, role).toBe(401);
    }
    expect(await prisma.product.count({ where: { name: "Cortado" } })).toBe(0);
    // A refused write leaves the storefront's cached catalog alone.
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("rejects an invalid form with 400 and per-field errors", async () => {
    signInAs("admin");
    const response = await createProduct(
      jsonRequest("POST", "/api/products", await productForm({ name: " ", price: "free", categoryId: "" })),
    );

    expect(response.status).toBe(400);
    const error = await readError(response);
    expect(error.code).toBe("VALIDATION");
    expect(error.fieldErrors).toMatchObject({
      name: "nameRequired",
      price: "priceInvalid",
      categoryId: "categoryRequired",
    });
  });

  it("rejects a body that isn't JSON with 400", async () => {
    signInAs("admin");
    const response = await createProduct(rawRequest("POST", "/api/products", "{not json"));

    expect(response.status).toBe(400);
    expect((await readError(response)).code).toBe("BAD_REQUEST");
  });

  it("creates, updates and deletes a product, logging each change", async () => {
    signInAs("admin");

    const created = await createProduct(jsonRequest("POST", "/api/products", await productForm()));
    expect(created.status).toBe(201);
    // The storefront's cached menu expires at once, so the new item shows on the next render.
    expect(revalidateTag).toHaveBeenCalledWith(CATALOG_TAGS.products, { expire: 0 });
    const product = await readJson<Product>(created);
    expect(product).toMatchObject({ name: "Cortado", price: 130000, stockQuantity: 40, isPublished: true });

    const translated = await getProduct(
      getRequest(`/api/products/${product.id}`, { "accept-language": "fa" }),
      routeParams({ id: product.id }),
    );
    expect((await readJson<Product>(translated)).name).toBe("کورتادو");

    const updated = await updateProduct(
      jsonRequest("PUT", `/api/products/${product.id}`, await productForm({ name: "Cortado doppio", price: "150000" })),
      routeParams({ id: product.id }),
    );
    expect(updated.status).toBe(200);
    expect(await readJson<Product>(updated)).toMatchObject({ name: "Cortado doppio", price: 150000 });

    const deleted = await deleteProduct(
      jsonRequest("DELETE", `/api/products/${product.id}`),
      routeParams({ id: product.id }),
    );
    expect(deleted.status).toBe(204);
    expect(await prisma.product.findUnique({ where: { id: product.id } })).toBeNull();

    const actions = await prisma.activityEntry.findMany({
      where: { entityId: product.id },
      orderBy: { createdAt: "asc" },
    });
    expect(actions.map((entry) => entry.action)).toEqual(["product.created", "product.updated", "product.deleted"]);
    expect(actions.every((entry) => entry.actorId === "09120000002")).toBe(true);
  });

  it("answers 404 when updating or deleting a product that doesn't exist", async () => {
    signInAs("owner");

    const updated = await updateProduct(
      jsonRequest("PUT", "/api/products/missing", await productForm()),
      routeParams({ id: "missing" }),
    );
    expect(updated.status).toBe(404);

    const deleted = await deleteProduct(jsonRequest("DELETE", "/api/products/missing"), routeParams({ id: "missing" }));
    expect(deleted.status).toBe(404);
  });

  it("requires a book's author", async () => {
    signInAs("admin");
    const response = await createProduct(
      jsonRequest("POST", "/api/products", await productForm({ kind: "book", bookAuthor: "" })),
    );

    expect(response.status).toBe(400);
    expect((await readError(response)).fieldErrors).toMatchObject({ bookAuthor: "authorRequired" });
  });

  it("switches an item to made to order without touching its stored count, and logs it", async () => {
    signInAs("admin");
    const created = await readJson<Product>(
      await createProduct(jsonRequest("POST", "/api/products", await productForm())),
    );

    // The form hides the stock field, so whatever it holds is ignored — even blank.
    const updated = await updateProduct(
      jsonRequest("PUT", `/api/products/${created.id}`, await productForm({ madeToOrder: true, stockQuantity: "" })),
      routeParams({ id: created.id }),
    );

    expect(updated.status).toBe(200);
    expect(await readJson<Product>(updated)).toMatchObject({ madeToOrder: true, stockQuantity: 40 });
    const entry = await prisma.activityEntry.findFirstOrThrow({
      where: { entityId: created.id, action: "product.updated" },
    });
    expect(entry.changes).toEqual([{ field: "madeToOrder", before: "false", after: "true" }]);
  });

  it("still needs the stock of a counted item", async () => {
    signInAs("admin");
    const response = await createProduct(
      jsonRequest("POST", "/api/products", await productForm({ stockQuantity: "" })),
    );

    expect(response.status).toBe(400);
    expect((await readError(response)).fieldErrors).toMatchObject({ stockQuantity: "stockRequired" });
  });
});

describe("dashboard product list", () => {
  it("is staff-only", async () => {
    expect((await listAdminProducts(getRequest("/api/admin/products"))).status).toBe(401);

    signInAs("customer");
    expect((await listAdminProducts(getRequest("/api/admin/products"))).status).toBe(401);
  });

  it("pages and filters the catalog", async () => {
    signInAs("staff");
    const response = await listAdminProducts(getRequest("/api/admin/products?pageSize=5&q=latte"));

    expect(response.status).toBe(200);
    const page = await readJson<{ items: Product[]; total: number; page: number; pageSize: number }>(response);
    expect(page.pageSize).toBe(5);
    expect(page.total).toBeGreaterThanOrEqual(2);
    expect(page.items.every((product) => /latte/i.test(product.name))).toBe(true);
  });

  it("finds items by their category's name", async () => {
    signInAs("staff");
    const category = await prisma.category.findUniqueOrThrow({ where: { slug: "hot-drinks" } });
    const inCategory = await prisma.product.count({ where: { categoryId: category.id } });
    const q = encodeURIComponent(category.name);
    const response = await listAdminProducts(getRequest(`/api/admin/products?categoryId=${category.id}&q=${q}`));

    expect(response.status).toBe(200);
    const page = await readJson<{ total: number }>(response);
    expect(inCategory).toBeGreaterThan(0);
    expect(page.total).toBe(inCategory);
  });

  /** Each listed row's ingredient warning (`null` for none), by id. */
  async function listedAlerts(query: string): Promise<{ alerts: Map<string, unknown>; total: number }> {
    signInAs("staff");
    const response = await listAdminProducts(getRequest(`/api/admin/products?pageSize=50&${query}`));
    expect(response.status).toBe(200);
    const page = await readJson<{ items: ProductListItem[]; total: number }>(response);
    return {
      alerts: new Map(page.items.map((item) => [item.id, item.ingredientAlert ?? null])),
      total: page.total,
    };
  }

  it("warns about a made-to-order item's worst ingredient, never a counted item's", async () => {
    const { alerts } = await listedAlerts("");

    // The seed's milk and saffron run low and its mint is out.
    expect(alerts.get("seed-mint-lemonade")).toEqual({ level: "out", ingredient: "Fresh mint" });
    // Milk and saffron both low: the first by name.
    expect(alerts.get("seed-saffron-latte")).toEqual({ level: "low", ingredient: "Milk" });
    expect(alerts.get("seed-espresso")).toBeNull();
    // A counted item goes by its count, even when the stock item behind it runs low.
    expect(alerts.get("seed-carrot-cake")).toBeNull();
  });

  it("needs attention for a low or out ingredient, and never for a made-to-order count", async () => {
    // Espresso's beans run out; the tea's count reads zero but isn't kept.
    await prisma.ingredient.update({ where: { id: "seed-ing-beans" }, data: { onHand: 0 } });
    await prisma.product.update({ where: { id: "seed-persian-tea" }, data: { stockQuantity: 0 } });

    const { alerts, total } = await listedAlerts("stock=needsRestock");

    expect(alerts.get("seed-espresso")).toEqual({ level: "out", ingredient: "Espresso beans" });
    // Milk is only low; the beans being out wins.
    expect(alerts.get("seed-cappuccino")).toEqual({ level: "out", ingredient: "Espresso beans" });
    expect(alerts.get("seed-mint-lemonade")).toEqual({ level: "out", ingredient: "Fresh mint" });
    expect(alerts.has("seed-persian-tea")).toBe(false);
    expect(alerts.has("seed-omelette")).toBe(false);
    // Counted items still by count: two copies of Savushun left, eighteen slices of carrot cake.
    expect(alerts.get("seed-book-savushun")).toBeNull();
    expect(alerts.has("seed-carrot-cake")).toBe(false);
    // The "need attention" count is this list's total.
    expect(total).toBe(alerts.size);
  });

  it("never counts a made-to-order item as out, low or in by count", async () => {
    await prisma.product.update({ where: { id: "seed-persian-tea" }, data: { stockQuantity: 0 } });

    for (const stock of ["out", "low", "in"]) {
      const { alerts } = await listedAlerts(`stock=${stock}`);
      expect(alerts.has("seed-persian-tea"), stock).toBe(false);
    }
  });
});
