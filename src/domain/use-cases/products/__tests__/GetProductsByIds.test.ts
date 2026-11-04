import { describe, expect, it, vi } from "vitest";

import { GetProductsByIds } from "../GetProductsByIds";

import type { Category } from "../../../entities/Category";
import type { Product } from "../../../entities/Product";
import type { IProductRepository } from "../../../repositories/IProductRepository";

const published = { id: "a", isPublished: true, categoryId: "shown" } as Product;
const draft = { id: "b", isPublished: false, categoryId: "shown" } as Product;
const inHiddenCategory = { id: "c", isPublished: true, categoryId: "hidden" } as Product;

const categories = {
  getAll: vi.fn(async () => [
    { id: "shown", isActive: true } as Category,
    { id: "hidden", isActive: false } as Category,
  ]),
};

function repo(): Pick<IProductRepository, "getByIds"> & { getByIds: ReturnType<typeof vi.fn> } {
  return { getByIds: vi.fn(async () => [published, draft, inHiddenCategory]) };
}

describe("GetProductsByIds", () => {
  it("hides items off the public menu by default (the endpoint is public)", async () => {
    expect(await new GetProductsByIds(repo(), categories).execute(["a", "b", "c"])).toEqual([published]);
  });

  it("includes them when the caller may see drafts", async () => {
    const products = await new GetProductsByIds(repo(), categories).execute(["a", "b", "c"], undefined, {
      includeUnpublished: true,
    });
    expect(products).toEqual([published, draft, inHiddenCategory]);
  });

  it("collapses duplicate ids before reading", async () => {
    const products = repo();
    await new GetProductsByIds(products, categories).execute(["a", "a", "b"]);
    expect(products.getByIds).toHaveBeenCalledWith(["a", "b"], undefined);
  });
});
