import { describe, expect, it } from "vitest";

import { DELETE as deleteCategory, GET as getCategory, PUT as updateCategory } from "@/app/api/categories/[id]/route";
import { GET as listCategories, POST as createCategory } from "@/app/api/categories/route";
import type { Category } from "@/src/domain/entities/Category";
import { prisma } from "@/src/infrastructure/prisma/client";

import { getRequest, jsonRequest, readError, readJson, routeParams } from "./helpers/http";
import { signInAs } from "./helpers/session";

const pastries = {
  name: "Pastries",
  slug: "pastries",
  iconUrl: "/images/seed/icon-cakes.svg",
  isActive: true,
  faName: "شیرینی",
};

async function create(body: unknown = pastries): Promise<Response> {
  return createCategory(jsonRequest("POST", "/api/categories", body));
}

describe("categories", () => {
  it("lists the seeded categories publicly", async () => {
    const response = await listCategories(getRequest("/api/categories"));

    expect(response.status).toBe(200);
    const slugs = (await readJson<Category[]>(response)).map((category) => category.slug);
    expect(slugs).toEqual(expect.arrayContaining(["hot-drinks", "cold-drinks", "cakes", "breakfast", "books"]));
  });

  it("finds one by slug, and 404s an unknown id", async () => {
    // Always an array (0 or 1 element), so the collection keeps one response shape.
    const bySlug = await listCategories(getRequest("/api/categories?slug=books"));
    expect((await readJson<Category[]>(bySlug)).map((category) => category.slug)).toEqual(["books"]);
    const noSlug = await listCategories(getRequest("/api/categories?slug=nope"));
    expect(await readJson<Category[]>(noSlug)).toEqual([]);

    const missing = await getCategory(getRequest("/api/categories/missing"), routeParams({ id: "missing" }));
    expect(missing.status).toBe(404);
  });

  it("only lets catalog writers create one", async () => {
    expect((await create()).status).toBe(401);

    signInAs("staff");
    expect((await create()).status).toBe(401);
    expect(await prisma.category.count({ where: { slug: "pastries" } })).toBe(0);
  });

  it("validates the form with 400 and per-field errors", async () => {
    signInAs("admin");
    const response = await create({ ...pastries, name: "", slug: "Not A Slug" });

    expect(response.status).toBe(400);
    expect((await readError(response)).fieldErrors).toMatchObject({ name: "nameRequired", slug: "slugFormat" });
  });

  it("creates, renames and deletes a category", async () => {
    signInAs("admin");

    const created = await create();
    expect(created.status).toBe(201);
    const category = await readJson<Category>(created);
    expect(category).toMatchObject({ name: "Pastries", slug: "pastries", productCount: 0 });

    const updated = await updateCategory(
      jsonRequest("PUT", `/api/categories/${category.id}`, { ...pastries, name: "Viennoiserie" }),
      routeParams({ id: category.id }),
    );
    expect(updated.status).toBe(200);
    expect((await readJson<Category>(updated)).name).toBe("Viennoiserie");

    const deleted = await deleteCategory(jsonRequest("DELETE", `/api/categories/${category.id}`), routeParams({ id: category.id }));
    expect(deleted.status).toBe(204);
    expect(await prisma.category.findUnique({ where: { id: category.id } })).toBeNull();
  });

  it("refuses a slug that's taken with 409", async () => {
    signInAs("admin");
    const response = await create({ ...pastries, slug: "books" });

    expect(response.status).toBe(409);
    const error = await readError(response);
    expect(error.code).toBe("UNIQUE_CONSTRAINT");
    expect(error.fieldErrors).toMatchObject({ slug: "alreadyTaken" });
  });

  it("refuses to delete a category that still has products (409)", async () => {
    signInAs("admin");
    const books = await prisma.category.findUniqueOrThrow({ where: { slug: "books" } });

    const response = await deleteCategory(jsonRequest("DELETE", `/api/categories/${books.id}`), routeParams({ id: books.id }));

    expect(response.status).toBe(409);
    expect((await readError(response)).code).toBe("IN_USE");
    expect(await prisma.category.findUnique({ where: { id: books.id } })).not.toBeNull();
  });

  it("answers 404 when updating or deleting a category that doesn't exist", async () => {
    signInAs("owner");
    const id = "00000000-0000-0000-0000-000000000000";

    expect((await updateCategory(jsonRequest("PUT", `/api/categories/${id}`, pastries), routeParams({ id }))).status).toBe(404);
    expect((await deleteCategory(jsonRequest("DELETE", `/api/categories/${id}`), routeParams({ id }))).status).toBe(404);
  });
});
