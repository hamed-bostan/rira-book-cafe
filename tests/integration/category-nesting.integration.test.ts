import { describe, expect, it } from "vitest";

import { PATCH as bulkCategories } from "@/app/api/admin/categories/bulk/route";
import { PUT as reorderCategories } from "@/app/api/admin/categories/order/route";
import { PATCH as bulkProducts } from "@/app/api/admin/products/bulk/route";
import { DELETE as deleteCategory, PUT as updateCategory } from "@/app/api/categories/[id]/route";
import { GET as listCategories, POST as createCategory } from "@/app/api/categories/route";
import { GET as listMenu } from "@/app/api/products/route";
import type { Category } from "@/src/domain/entities/Category";
import type { Product } from "@/src/domain/entities/Product";
import { prisma } from "@/src/infrastructure/prisma/client";

import { getRequest, jsonRequest, readError, readJson, routeParams } from "./helpers/http";
import { signInAs } from "./helpers/session";

const ICON = "/images/seed/icon-cakes.svg";

async function create(body: Record<string, unknown>): Promise<Category> {
  const response = await createCategory(
    jsonRequest("POST", "/api/categories", { iconUrl: ICON, isActive: true, faName: "", ...body }),
  );
  expect(response.status).toBe(201);
  return readJson<Category>(response);
}

async function list(): Promise<Category[]> {
  return readJson<Category[]>(await listCategories(getRequest("/api/categories")));
}

async function menuIds(): Promise<string[]> {
  return (await readJson<Product[]>(await listMenu(getRequest("/api/products")))).map((product) => product.id);
}

describe("category nesting", () => {
  it("files a subcategory under a parent and lists it straight after the parent", async () => {
    signInAs("admin");
    const hot = await prisma.category.findUniqueOrThrow({ where: { slug: "hot-drinks" } });
    const espresso = await create({ name: "Espresso", slug: "espresso", parentId: hot.id });
    expect(espresso.parentId).toBe(hot.id);

    const slugs = (await list()).map((category) => category.slug);
    expect(slugs[slugs.indexOf("hot-drinks") + 1]).toBe("espresso");
  });

  it("refuses a subcategory as a parent, and a parent with subcategories moving under another", async () => {
    signInAs("admin");
    const hot = await prisma.category.findUniqueOrThrow({ where: { slug: "hot-drinks" } });
    const cakes = await prisma.category.findUniqueOrThrow({ where: { slug: "cakes" } });
    const espresso = await create({ name: "Espresso", slug: "espresso", parentId: hot.id });

    const nested = await createCategory(
      jsonRequest("POST", "/api/categories", {
        name: "Ristretto",
        slug: "ristretto",
        iconUrl: ICON,
        faName: "",
        parentId: espresso.id,
      }),
    );
    expect(nested.status).toBe(409);
    expect(await readError(nested)).toMatchObject({
      code: "PARENT_IS_SUBCATEGORY",
      fieldErrors: { parentId: "parentIsSubcategory" },
    });

    const moveParent = await updateCategory(
      jsonRequest("PUT", `/api/categories/${hot.id}`, {
        name: hot.name,
        slug: hot.slug,
        iconUrl: hot.iconUrl,
        faName: "",
        parentId: cakes.id,
      }),
      routeParams({ id: hot.id }),
    );
    expect(moveParent.status).toBe(409);
    expect((await readError(moveParent)).code).toBe("HAS_SUBCATEGORIES");
  });

  it("refuses to delete a parent while it has subcategories", async () => {
    signInAs("admin");
    const parent = await create({ name: "Seasonal", slug: "seasonal" });
    await create({ name: "Winter", slug: "winter", parentId: parent.id });

    const response = await deleteCategory(
      jsonRequest("DELETE", `/api/categories/${parent.id}`),
      routeParams({ id: parent.id }),
    );
    expect(response.status).toBe(409);
    expect((await readError(response)).code).toBe("HAS_SUBCATEGORIES");
  });

  it("hides a subcategory's items when its parent is hidden, and shows them again", async () => {
    signInAs("admin");
    const hot = await prisma.category.findUniqueOrThrow({ where: { slug: "hot-drinks" } });
    const espresso = await create({ name: "Espresso", slug: "espresso", parentId: hot.id });
    const item = await prisma.product.findFirstOrThrow({ where: { categoryId: hot.id, isPublished: true } });
    const moved = await bulkProducts(
      jsonRequest("PATCH", "/api/admin/products/bulk", {
        ids: [item.id],
        action: { type: "assignCategory", categoryId: espresso.id },
      }),
    );
    expect(moved.status).toBe(200);
    expect(await menuIds()).toContain(item.id);

    const hide = (type: "activate" | "deactivate"): Promise<Response> =>
      bulkCategories(jsonRequest("PATCH", "/api/admin/categories/bulk", { ids: [hot.id], action: { type } }));
    expect((await hide("deactivate")).status).toBe(200);
    expect(await menuIds()).not.toContain(item.id);

    expect((await hide("activate")).status).toBe(200);
    expect(await menuIds()).toContain(item.id);
  });

  it("reorders one parent's categories in one request and logs only the moved one", async () => {
    signInAs("admin");
    const before = (await list()).filter((category) => category.parentId === null).map((category) => category.id);
    const last = before.at(-1)!;
    const next = [last, ...before.slice(0, -1)];

    const response = await reorderCategories(
      jsonRequest("PUT", "/api/admin/categories/order", { parentId: null, ids: next }),
    );
    expect(response.status).toBe(204);
    expect((await list()).filter((category) => category.parentId === null).map((category) => category.id)).toEqual(
      next,
    );

    const entries = await prisma.activityEntry.findMany({
      where: { entityType: "category", action: "category.updated" },
    });
    expect(entries).toHaveLength(1);
    expect(entries[0].entityId).toBe(last);
    expect(entries[0].changedFields).toEqual(["menuPosition"]);
  });

  it("refuses to reorder across parents, and refuses anyone without catalog access", async () => {
    signInAs("admin");
    const hot = await prisma.category.findUniqueOrThrow({ where: { slug: "hot-drinks" } });
    const espresso = await create({ name: "Espresso", slug: "espresso", parentId: hot.id });

    const mixed = await reorderCategories(
      jsonRequest("PUT", "/api/admin/categories/order", { parentId: null, ids: [espresso.id, hot.id] }),
    );
    expect(mixed.status).toBe(400);

    signInAs("staff");
    const denied = await reorderCategories(
      jsonRequest("PUT", "/api/admin/categories/order", { parentId: hot.id, ids: [espresso.id] }),
    );
    expect(denied.status).toBe(401);
  });
});
