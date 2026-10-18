import { describe, expect, it, vi } from "vitest";

import { GetProductsByIds } from "../GetProductsByIds";

import type { Product } from "../../../entities/Product";
import type { IProductRepository } from "../../../repositories/IProductRepository";

const published = { id: "a", isPublished: true } as Product;
const draft = { id: "b", isPublished: false } as Product;

function repo(): IProductRepository {
  return { getByIds: vi.fn(async () => [published, draft]) } as unknown as IProductRepository;
}

describe("GetProductsByIds", () => {
  it("hides unpublished products by default (the endpoint is public)", async () => {
    expect(await new GetProductsByIds(repo()).execute(["a", "b"])).toEqual([published]);
  });

  it("includes them when the caller may see drafts", async () => {
    const products = await new GetProductsByIds(repo()).execute(["a", "b"], undefined, { includeUnpublished: true });
    expect(products).toEqual([published, draft]);
  });

  it("collapses duplicate ids before reading", async () => {
    const products = repo();
    await new GetProductsByIds(products).execute(["a", "a", "b"]);
    expect(products.getByIds).toHaveBeenCalledWith(["a", "b"], undefined);
  });
});
