import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { POST as bulkDelete } from "@/app/api/admin/products/bulk/delete/route";
import { DELETE as deleteProduct, PUT as updateProduct } from "@/app/api/products/[id]/route";
import { POST as createProduct } from "@/app/api/products/route";
import type { Product } from "@/src/domain/entities/Product";
import { prisma } from "@/src/infrastructure/prisma/client";
import { PrismaImageReferences } from "@/src/infrastructure/repositories/PrismaImageReferences";

import { jsonRequest, readError, readJson, routeParams } from "./helpers/http";
import { signInAs } from "./helpers/session";

/** A valid product form, as the dashboard sends it. */
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
    description: "",
    nutrition: "",
    origin: "",
    dietary: [],
    taxExempt: false,
    bookAuthor: "",
    bookIsbn: "",
    bookAvailability: "sale",
    faName: "",
    faUnit: "",
    faDescription: "",
    faNutrition: "",
    faOrigin: "",
    ...overrides,
  };
}

/** Put a file in the uploads folder, as an upload would, and return its URL. */
function uploaded(name: string): { url: string; file: string } {
  const folder = join(process.env.UPLOADS_DIR ?? "", "products");
  mkdirSync(folder, { recursive: true });
  const file = join(folder, name);
  writeFileSync(file, "png");
  return { url: `/uploads/products/${name}`, file };
}

async function create(overrides: Record<string, unknown> = {}): Promise<Product> {
  const response = await createProduct(jsonRequest("POST", "/api/products", await productForm(overrides)));
  expect(response.status).toBe(201);
  return readJson<Product>(response);
}

describe("bulk delete", () => {
  it("deletes the selection, logs each, and reports what it couldn't find", async () => {
    signInAs("admin");
    const first = await create({ name: "Bulk one" });
    const second = await create({ name: "Bulk two" });

    const response = await bulkDelete(
      jsonRequest("POST", "/api/admin/products/bulk/delete", { ids: [first.id, second.id, "missing"] }),
    );
    expect(response.status).toBe(200);
    expect(await readJson(response)).toEqual({
      deleted: 2,
      refused: [{ id: "missing", name: "", reason: "notFound" }],
    });
    expect(await prisma.product.count({ where: { id: { in: [first.id, second.id] } } })).toBe(0);
    expect(
      await prisma.activityEntry.count({
        where: { action: "product.deleted", entityId: { in: [first.id, second.id] } },
      }),
    ).toBe(2);
  });

  it("is for catalog writers only, and validates the selection", async () => {
    signInAs("staff");
    expect((await bulkDelete(jsonRequest("POST", "/api/admin/products/bulk/delete", { ids: ["x"] }))).status).toBe(401);

    signInAs("admin");
    const empty = await bulkDelete(jsonRequest("POST", "/api/admin/products/bulk/delete", { ids: [] }));
    expect(empty.status).toBe(400);
    expect((await readError(empty)).fieldErrors).toMatchObject({ ids: "selectionRequired" });
  });
});

describe("product image cleanup", () => {
  it("deletes a replaced picture's file once nothing uses it", async () => {
    signInAs("admin");
    const old = uploaded("old-picture.png");
    const product = await create({ imageUrl: old.url });

    const response = await updateProduct(
      jsonRequest("PUT", `/api/products/${product.id}`, await productForm({ imageUrl: "/images/seed/espresso.svg" })),
      routeParams({ id: product.id }),
    );
    expect(response.status).toBe(200);
    expect(existsSync(old.file)).toBe(false);
  });

  it("keeps a picture another row still uses, and deletes an unused one with its item", async () => {
    signInAs("admin");
    const sold = uploaded("sold-picture.png");
    const soldItem = await create({ name: "Sold", imageUrl: sold.url });
    // Something else points at the same file — an order line that snapshotted it
    // would; here a category does (every column is checked the same way).
    const category = await prisma.category.findFirstOrThrow();
    await prisma.category.update({ where: { id: category.id }, data: { iconUrl: sold.url } });

    const unsold = uploaded("unsold-picture.png");
    const unsoldItem = await create({ name: "Unsold", imageUrl: unsold.url });

    for (const item of [soldItem, unsoldItem]) {
      const response = await deleteProduct(
        jsonRequest("DELETE", `/api/products/${item.id}`),
        routeParams({ id: item.id }),
      );
      expect(response.status).toBe(204);
    }
    expect(existsSync(sold.file)).toBe(true);
    expect(existsSync(unsold.file)).toBe(false);
  });

  it("finds a reference in every column that stores an image", async () => {
    const references = new PrismaImageReferences();
    const category = await prisma.category.findFirstOrThrow();
    const product = await prisma.product.findFirstOrThrow();
    expect(await references.isReferenced(category.iconUrl)).toBe(true);
    expect(await references.isReferenced(product.imageUrl)).toBe(true);
    expect(await references.isReferenced("/uploads/products/nobody.png")).toBe(false);
  });
});
