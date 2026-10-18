import { revalidateTag } from "next/cache";
import { describe, expect, it } from "vitest";

import { GET as getAdminProduct } from "@/app/api/admin/products/[id]/route";
import { GET as listAdminProducts } from "@/app/api/admin/products/route";
import { DELETE as deleteProduct, GET as getProduct, PUT as updateProduct } from "@/app/api/products/[id]/route";
import { GET as listProducts, POST as createProduct } from "@/app/api/products/route";
import type { Product } from "@/src/domain/entities/Product";
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
});
