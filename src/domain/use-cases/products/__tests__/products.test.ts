import { describe, expect, it, vi } from "vitest";

import { isSellable, withoutCost, type Product } from "../../../entities/Product";
import { NotFoundError } from "../../../errors/NotFoundError";
import { ValidationError } from "../../../errors/ValidationError";
import { BulkUpdateProducts } from "../BulkUpdateProducts";
import { CreateProduct } from "../CreateProduct";
import { DeleteProduct } from "../DeleteProduct";
import { GetFeaturedProducts } from "../GetFeaturedProducts";
import { GetProductById } from "../GetProductById";
import { GetProducts } from "../GetProducts";
import { GetProductsByIds } from "../GetProductsByIds";
import { GetProductTranslations } from "../GetProductTranslations";
import { GetPublishedProduct } from "../GetPublishedProduct";
import { ListProducts } from "../ListProducts";
import { productSnapshot } from "../productActivity";
import { SearchProducts } from "../SearchProducts";
import { UpdateProduct } from "../UpdateProduct";

import type { NewActivityEntry } from "../../../entities/ActivityEntry";
import type { BulkProductChange, BulkProductUpdate, IProductRepository, NewProduct } from "../../../repositories/IProductRepository";

const ACTOR = { id: "a1", name: "Admin" };

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: "p1",
    kind: "drink",
    name: "Latte",
    price: 150_000,
    rating: 4,
    ratingCount: 2,
    stockQuantity: 10,
    imageUrl: "https://cdn/latte.png",
    categoryId: "c1",
    isFeatured: false,
    isPublished: true,
    taxExempt: false,
    ...overrides,
  };
}

const INPUT: NewProduct = {
  kind: "drink",
  name: "  Mocha ",
  price: 180_000,
  stockQuantity: 5,
  imageUrl: "https://cdn/mocha.png",
  categoryId: "c1",
  isFeatured: false,
  isPublished: true,
  taxExempt: false,
};

type Fake = {
  repo: IProductRepository;
  create: ReturnType<typeof vi.fn<IProductRepository["create"]>>;
  update: ReturnType<typeof vi.fn<IProductRepository["update"]>>;
  remove: ReturnType<typeof vi.fn<IProductRepository["delete"]>>;
  search: ReturnType<typeof vi.fn<IProductRepository["search"]>>;
  listPage: ReturnType<typeof vi.fn<IProductRepository["listPage"]>>;
  getByIds: ReturnType<typeof vi.fn<IProductRepository["getByIds"]>>;
  applyBulkChange: ReturnType<typeof vi.fn<IProductRepository["applyBulkChange"]>>;
  entries: (NewActivityEntry | null)[];
};

/** An in-memory catalog whose writes run the audit hook the way the real repository does. */
function repoWith(rows: Product[]): Fake {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const entries: (NewActivityEntry | null)[] = [];
  const persist = (id: string, input: NewProduct): Product => {
    const { translations: _translations, ...fields } = input;
    return { ...product({ id }), ...fields, id };
  };

  const create = vi.fn<IProductRepository["create"]>(async (input, audit) => {
    const saved = persist("new", input);
    if (audit) entries.push(audit(saved));
    return saved;
  });
  const update = vi.fn<IProductRepository["update"]>(async (id, input, audit) => {
    const saved = persist(id, input);
    if (audit) entries.push(audit(saved));
    return saved;
  });
  const remove = vi.fn<IProductRepository["delete"]>(async (_id, audit) => {
    if (audit) entries.push(audit());
  });
  const search = vi.fn<IProductRepository["search"]>(async () => rows);
  const listPage = vi.fn<IProductRepository["listPage"]>(async (_filters, page) => ({ items: rows, total: rows.length, page: page.page, pageSize: page.pageSize }));
  const getByIds = vi.fn<IProductRepository["getByIds"]>(async (ids) => rows.filter((row) => ids.includes(row.id)));
  const applyBulkChange = vi.fn<IProductRepository["applyBulkChange"]>(async (ids, change: BulkProductChange, audit) => {
    const updates: BulkProductUpdate[] = ids
      .map((id) => byId.get(id))
      .filter((row): row is Product => row !== undefined && row[change.field] !== change.value)
      .map((previous) => ({ previous, product: { ...previous, [change.field]: change.value } }));
    if (audit) updates.forEach((u) => entries.push(audit(u)));
    return updates;
  });

  const repo: IProductRepository = {
    getAll: vi.fn(async () => rows),
    getById: vi.fn(async (id: string) => byId.get(id) ?? null),
    getPublishedById: vi.fn(async (id: string) => {
      const row = byId.get(id);
      return row?.isPublished ? row : null;
    }),
    getByIds,
    getFeatured: vi.fn(async () => rows.filter((row) => row.isFeatured)),
    search,
    listPage,
    create,
    update,
    delete: remove,
    applyBulkChange,
    getTranslations: vi.fn(async () => [{ locale: "fa", name: "لاته" }]),
  };
  return { repo, create, update, remove, search, listPage, getByIds, applyBulkChange, entries };
}

describe("productSnapshot", () => {
  it("flattens book details and dietary tags for diffing", () => {
    const snapshot = productSnapshot(
      product({ kind: "book", book: { author: "Hedayat", isbn: "123", availability: "both" }, dietary: ["Vegan", "Gluten-Free"] }),
    );
    expect(snapshot).toMatchObject({ bookAuthor: "Hedayat", bookIsbn: "123", bookAvailability: "both", dietary: "Vegan, Gluten-Free" });
    // Ratings move on their own and are never part of an admin diff.
    expect(snapshot).not.toHaveProperty("rating");
    expect(productSnapshot(product()).bookAuthor).toBeUndefined();
  });
});

describe("CreateProduct", () => {
  it("validates, trims and records the starting kind, price and stock", async () => {
    const { repo, create, entries } = repoWith([]);
    const saved = await new CreateProduct(repo).execute(INPUT, ACTOR);

    expect(saved.name).toBe("Mocha");
    expect(create.mock.calls[0][0].name).toBe("Mocha");
    expect(entries[0]).toEqual({
      actorId: "a1",
      actorName: "Admin",
      action: "product.created",
      entityType: "product",
      entityId: "new",
      entityLabel: "Mocha",
      changes: [
        { field: "kind", before: null, after: "drink" },
        { field: "price", before: null, after: "180000" },
        { field: "stockQuantity", before: null, after: "5" },
      ],
    });
  });

  it("drops book details from a drink", async () => {
    const { repo, create } = repoWith([]);
    await new CreateProduct(repo).execute({ ...INPUT, book: { author: "X", availability: "sale" } }, ACTOR);
    expect(create.mock.calls[0][0].book).toBeUndefined();
  });

  it("refuses an invalid product before writing", async () => {
    const { repo, create } = repoWith([]);
    await expect(new CreateProduct(repo).execute({ ...INPUT, price: 0 }, ACTOR)).rejects.toThrow(ValidationError);
    expect(create).not.toHaveBeenCalled();
  });
});

describe("UpdateProduct", () => {
  it("diffs the tracked fields against the stored row", async () => {
    const { repo, entries } = repoWith([product()]);
    await new UpdateProduct(repo).execute("p1", { ...INPUT, name: "Latte", price: 160_000, stockQuantity: 10, imageUrl: product().imageUrl }, ACTOR);
    expect(entries[0]).toMatchObject({ action: "product.updated", entityId: "p1", entityLabel: "Latte" });
    expect(entries[0]?.changes).toEqual([{ field: "price", before: "150000", after: "160000" }]);
  });

  it("writes no entry for a save that changed nothing", async () => {
    const existing = product();
    const { repo, entries } = repoWith([existing]);
    const { id: _id, rating: _rating, ratingCount: _ratingCount, ...same } = existing;
    await new UpdateProduct(repo).execute("p1", same, ACTOR);
    expect(entries).toEqual([null]);
  });

  it("refuses a missing id, an unknown one, and invalid input", async () => {
    const { repo, update } = repoWith([product()]);
    await expect(new UpdateProduct(repo).execute("", INPUT, ACTOR)).rejects.toMatchObject({ field: "id" });
    await expect(new UpdateProduct(repo).execute("missing", INPUT, ACTOR)).rejects.toThrow(NotFoundError);
    await expect(new UpdateProduct(repo).execute("p1", { ...INPUT, name: " " }, ACTOR)).rejects.toMatchObject({ field: "name" });
    expect(update).not.toHaveBeenCalled();
  });
});

describe("DeleteProduct", () => {
  it("records every set field going away", async () => {
    const { repo, remove, entries } = repoWith([product({ badge: "New" })]);
    await new DeleteProduct(repo).execute("p1", ACTOR);
    expect(remove.mock.calls[0][0]).toBe("p1");
    expect(entries[0]).toMatchObject({ action: "product.deleted", entityType: "product", entityId: "p1", entityLabel: "Latte" });
    const changes = entries[0]?.changes ?? [];
    expect(changes.every((change) => change.after === null && change.before !== null)).toBe(true);
    expect(changes).toEqual(
      expect.arrayContaining([
        { field: "name", before: "Latte", after: null },
        { field: "price", before: "150000", after: null },
        { field: "badge", before: "New", after: null },
        { field: "isPublished", before: "true", after: null },
      ]),
    );
    // Unset optional fields aren't listed.
    expect(changes.find((change) => change.field === "originalPrice")).toBeUndefined();
  });

  it("refuses a missing id and an unknown one", async () => {
    const { repo, remove } = repoWith([]);
    await expect(new DeleteProduct(repo).execute("", ACTOR)).rejects.toThrow(ValidationError);
    await expect(new DeleteProduct(repo).execute("missing", ACTOR)).rejects.toThrow(NotFoundError);
    expect(remove).not.toHaveBeenCalled();
  });
});

describe("BulkUpdateProducts", () => {
  it("returns the products that changed, each with a one-field entry", async () => {
    const { repo, entries } = repoWith([product({ id: "p1", categoryId: "c1" }), product({ id: "p2", name: "Tea", categoryId: "c2" })]);
    const changed = await new BulkUpdateProducts(repo).execute(["p1", "p2"], { field: "categoryId", value: "c2" }, ACTOR);
    expect(changed.map((p) => p.id)).toEqual(["p1"]);
    expect(entries).toEqual([
      {
        actorId: "a1",
        actorName: "Admin",
        action: "product.updated",
        entityType: "product",
        entityId: "p1",
        entityLabel: "Latte",
        changes: [{ field: "categoryId", before: "c1", after: "c2" }],
      },
    ]);
  });

  it("refuses an empty or oversized selection and a blank category", async () => {
    const { repo, applyBulkChange } = repoWith([]);
    const useCase = new BulkUpdateProducts(repo);
    await expect(useCase.execute([], { field: "isPublished", value: false }, ACTOR)).rejects.toMatchObject({ field: "ids" });
    await expect(useCase.execute(Array.from({ length: 201 }, (_, i) => `p${i}`), { field: "isPublished", value: false }, ACTOR)).rejects.toMatchObject({
      field: "ids",
    });
    await expect(useCase.execute(["p1"], { field: "categoryId", value: "" }, ACTOR)).rejects.toMatchObject({ field: "categoryId" });
    expect(applyBulkChange).not.toHaveBeenCalled();
  });
});

describe("ListProducts / SearchProducts", () => {
  it("normalizes a blank management search to no term, but still lists", async () => {
    const { repo, listPage } = repoWith([product()]);
    const page = { page: 2, pageSize: 10 };
    await new ListProducts(repo).execute({ query: "   ", kind: "food" }, page, "fa");
    await new ListProducts(repo).execute({ query: " latte " }, page);
    expect(listPage.mock.calls).toEqual([
      [{ query: undefined, kind: "food" }, page, "fa"],
      [{ query: "latte" }, page, undefined],
    ]);
  });

  it("returns nothing for an all-empty search without asking the repository", async () => {
    const { repo, search } = repoWith([product()]);
    expect(await new SearchProducts(repo).execute({ query: "   ", sort: "price-asc", dietary: [] })).toEqual([]);
    expect(search).not.toHaveBeenCalled();
  });

  it("searches with a trimmed term or any other criterion", async () => {
    const { repo, search } = repoWith([product()]);
    await new SearchProducts(repo).execute({ query: " latte " }, "en");
    await new SearchProducts(repo).execute({ maxPrice: 100_000 });
    expect(search.mock.calls).toEqual([
      [{ query: "latte" }, "en"],
      [{ query: undefined, maxPrice: 100_000 }, undefined],
    ]);
  });
});

describe("product queries", () => {
  it("collapse duplicate ids before resolving them", async () => {
    const { repo, getByIds } = repoWith([product({ id: "p1" }), product({ id: "p2" })]);
    const found = await new GetProductsByIds(repo).execute(["p1", "p2", "p1"], "fa");
    expect(getByIds).toHaveBeenCalledWith(["p1", "p2"], "fa");
    expect(found).toHaveLength(2);
  });

  it("hide an unpublished product from the storefront but not the dashboard", async () => {
    const hidden = product({ isPublished: false });
    const { repo } = repoWith([hidden]);
    expect(await new GetPublishedProduct(repo).execute("p1")).toBeNull();
    expect(await new GetProductById(repo).execute("p1")).toBe(hidden);
  });

  it("delegate the menu reads", async () => {
    const featured = product({ id: "f", isFeatured: true });
    const { repo } = repoWith([product(), featured]);
    expect(await new GetProducts(repo).execute("fa")).toHaveLength(2);
    expect(repo.getAll).toHaveBeenCalledWith("fa");
    expect(await new GetFeaturedProducts(repo).execute()).toEqual([featured]);
    expect(await new GetProductTranslations(repo).execute("p1")).toEqual([{ locale: "fa", name: "لاته" }]);
  });
});

describe("Product entity helpers", () => {
  it("strips the cost price for guests", () => {
    const stripped = withoutCost(product({ costPrice: 40_000 }));
    expect(stripped).not.toHaveProperty("costPrice");
    expect(stripped.price).toBe(150_000);
  });

  it("knows a reading-only book can't be sold", () => {
    expect(isSellable(product())).toBe(true);
    expect(isSellable(product({ kind: "book", book: { author: "A", availability: "reading" } }))).toBe(false);
    expect(isSellable(product({ kind: "book", book: { author: "A", availability: "both" } }))).toBe(true);
  });
});
