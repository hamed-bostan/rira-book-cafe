import { describe, expect, it, vi } from "vitest";

import { DeleteProduct } from "../DeleteProduct";
import { UpdateProduct } from "../UpdateProduct";

import type { Product } from "../../../entities/Product";
import type { IProductRepository, NewProduct } from "../../../repositories/IProductRepository";

const ACTOR = { id: "a1", name: "Admin" };
const OLD = "/uploads/products/old.webp";
const NEW = "/uploads/products/new.webp";

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: "p1",
    kind: "drink",
    name: "Latte",
    price: 150_000,
    rating: 0,
    ratingCount: 0,
    stockQuantity: 10,
    madeToOrder: false,
    imageUrl: OLD,
    categoryId: "c1",
    isFeatured: false,
    isPublished: true,
    taxExempt: false,
    ...overrides,
  };
}

function input(imageUrl: string): NewProduct {
  const { id: _id, rating: _r, ratingCount: _c, ...fields } = product({ imageUrl });
  return fields;
}

/** The order of events: the write, then the cleanup — never the other way round. */
function setup(references: { isReferenced: (url: string) => Promise<boolean> }) {
  const events: string[] = [];
  const repo = {
    getById: vi.fn(async () => product()),
    update: vi.fn(async (_id: string, values: NewProduct) => {
      events.push("write");
      return product({ imageUrl: values.imageUrl });
    }),
    delete: vi.fn(async () => {
      events.push("write");
    }),
  } as unknown as IProductRepository;
  const storage = {
    pathForUrl: (url: string) => (url.startsWith("/uploads/") ? url : null),
    removeByUrl: vi.fn(async (url: string) => {
      events.push(`remove ${url}`);
    }),
  };
  const shelf = { countOpenForBook: async () => 0 };
  const line = { listOpenForBook: async () => [] };
  const categories = { getById: async () => ({ id: "c1" }) as never };
  return { events, repo, storage, shelf, line, categories, images: { references, storage } };
}

describe("product image cleanup", () => {
  it("reclaims the replaced picture after the save commits", async () => {
    const s = setup({ isReferenced: async () => false });
    await new UpdateProduct(s.repo, s.shelf, s.categories, s.images).execute("p1", input(NEW), ACTOR);
    expect(s.events).toEqual(["write", `remove ${OLD}`]);
  });

  it("keeps the picture when the save didn't change it", async () => {
    const s = setup({ isReferenced: async () => false });
    await new UpdateProduct(s.repo, s.shelf, s.categories, s.images).execute("p1", input(OLD), ACTOR);
    expect(s.storage.removeByUrl).not.toHaveBeenCalled();
  });

  it("keeps a replaced picture an order line still shows", async () => {
    const s = setup({ isReferenced: async (url) => url === OLD });
    await new UpdateProduct(s.repo, s.shelf, s.categories, s.images).execute("p1", input(NEW), ACTOR);
    expect(s.storage.removeByUrl).not.toHaveBeenCalled();
  });

  it("reclaims a deleted item's picture after the delete", async () => {
    const s = setup({ isReferenced: async () => false });
    await new DeleteProduct(s.repo, s.shelf, s.line, s.images).execute("p1", ACTOR);
    expect(s.events).toEqual(["write", `remove ${OLD}`]);
  });

  it("never deletes a seed picture", async () => {
    const s = setup({ isReferenced: async () => false });
    vi.mocked(s.repo.getById).mockResolvedValue(product({ imageUrl: "/images/seed/latte.webp" }));
    await new DeleteProduct(s.repo, s.shelf, s.line, s.images).execute("p1", ACTOR);
    expect(s.storage.removeByUrl).not.toHaveBeenCalled();
  });
});
