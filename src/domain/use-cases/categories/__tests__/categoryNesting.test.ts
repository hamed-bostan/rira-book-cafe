import { describe, expect, it, vi } from "vitest";

import { ConflictError } from "../../../errors/ConflictError";
import { NotFoundError } from "../../../errors/NotFoundError";
import { ValidationError } from "../../../errors/ValidationError";
import { categoryLookup } from "../../products/publicMenu";
import { CreateCategory } from "../CreateCategory";
import { DeleteCategory } from "../DeleteCategory";
import { MoveCategory } from "../MoveCategory";
import { movedIds, ReorderCategories } from "../ReorderCategories";
import { UpdateCategory } from "../UpdateCategory";

import type { NewActivityEntry } from "../../../entities/ActivityEntry";
import type { Category } from "../../../entities/Category";
import type { ICategoryRepository, NewCategory } from "../../../repositories/ICategoryRepository";
import type { IImageStorageRepository } from "../../../repositories/IImageStorageRepository";

const ACTOR = { id: "a1", name: "Admin" };

function category(id: string, overrides: Partial<Category> = {}): Category {
  return {
    id,
    name: id.toUpperCase(),
    slug: id,
    iconUrl: `/uploads/categories/${id}.png`,
    isActive: true,
    parentId: null,
    productCount: 0,
    hiddenProductCount: 0,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    ...overrides,
  };
}

/** Drinks (with Coffee and Tea under it), then Food — in menu order. */
const MENU = (): Category[] => [
  category("drinks", { name: "Drinks" }),
  category("coffee", { name: "Coffee", parentId: "drinks" }),
  category("tea", { name: "Tea", parentId: "drinks" }),
  category("food", { name: "Food" }),
];

function repoWith(rows: Category[]) {
  const entries: (NewActivityEntry | null)[] = [];
  const repo = {
    getAll: vi.fn(async () => rows),
    getById: vi.fn(async (id: string) => rows.find((row) => row.id === id) ?? null),
    getBySlug: vi.fn(async (slug: string) => rows.find((row) => row.slug === slug) ?? null),
    create: vi.fn<ICategoryRepository["create"]>(async (input, audit) => {
      const saved = category("new", { ...input, isActive: input.isActive ?? true, parentId: input.parentId ?? null });
      if (audit) entries.push(audit(saved));
      return saved;
    }),
    update: vi.fn<ICategoryRepository["update"]>(async (id, input, audit) => {
      const current = rows.find((row) => row.id === id)!;
      const saved = {
        ...current,
        ...input,
        parentId: input.parentId === undefined ? current.parentId : input.parentId,
      };
      if (audit) entries.push(audit(saved));
      return saved;
    }),
    delete: vi.fn<ICategoryRepository["delete"]>(async () => {}),
    getTranslations: vi.fn(async () => []),
    applyBulkChange: vi.fn(async () => []),
    setOrder: vi.fn<ICategoryRepository["setOrder"]>(async (_parentId, _ids, audits = []) => {
      for (const audit of audits) entries.push(audit());
    }),
  } satisfies ICategoryRepository;
  return { repo, entries };
}

const STORAGE = { removeByUrl: vi.fn(async () => {}) } as unknown as IImageStorageRepository;

const input = (overrides: Partial<NewCategory> = {}): NewCategory => ({
  name: "Juice",
  slug: "juice",
  iconUrl: "/uploads/categories/juice.png",
  ...overrides,
});

describe("creating and editing with a parent", () => {
  it("files a new category under a top-level parent and logs the parent's name", async () => {
    const { repo, entries } = repoWith(MENU());
    await new CreateCategory(repo).execute(input({ parentId: "drinks" }), ACTOR);
    expect(repo.create.mock.calls[0][0].parentId).toBe("drinks");
    expect(entries[0]?.changes).toContainEqual({ field: "parent", before: null, after: "Drinks" });
  });

  it("refuses a subcategory as the parent (one level only)", async () => {
    const { repo } = repoWith(MENU());
    await expect(new CreateCategory(repo).execute(input({ parentId: "coffee" }), ACTOR)).rejects.toMatchObject({
      code: "PARENT_IS_SUBCATEGORY",
      fields: ["parentId"],
    });
    expect(repo.create).not.toHaveBeenCalled();
  });

  it("refuses a parent that doesn't exist", async () => {
    const { repo } = repoWith(MENU());
    await expect(new CreateCategory(repo).execute(input({ parentId: "gone" }), ACTOR)).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it("refuses filing a category under itself or making a parent a subcategory", async () => {
    const { repo } = repoWith(MENU());
    const update = new UpdateCategory(repo, STORAGE);
    await expect(update.execute("food", input({ slug: "food", parentId: "food" }), ACTOR)).rejects.toBeInstanceOf(
      ValidationError,
    );
    await expect(update.execute("drinks", input({ slug: "drinks", parentId: "food" }), ACTOR)).rejects.toMatchObject({
      code: "HAS_SUBCATEGORIES",
    });
    expect(repo.update).not.toHaveBeenCalled();
  });

  it("moves a subcategory to the top level and records the parent leaving", async () => {
    const { repo, entries } = repoWith(MENU());
    await new UpdateCategory(repo, STORAGE).execute(
      "tea",
      input({ name: "Tea", slug: "tea", iconUrl: "/uploads/categories/tea.png", parentId: null }),
      ACTOR,
    );
    expect(entries[0]?.changes).toEqual([{ field: "parent", before: "Drinks", after: null }]);
  });

  it("leaves the parent alone when the save doesn't mention it", async () => {
    const { repo, entries } = repoWith(MENU());
    await new UpdateCategory(repo, STORAGE).execute(
      "tea",
      input({ name: "Tea", slug: "tea", iconUrl: "/uploads/categories/tea.png" }),
      ACTOR,
    );
    expect(repo.update.mock.calls[0][1].parentId).toBeUndefined();
    expect(entries).toEqual([null]);
  });
});

describe("deleting a parent", () => {
  it("is refused while it has subcategories", async () => {
    const { repo } = repoWith(MENU());
    const error = await new DeleteCategory(repo, STORAGE).execute("drinks", ACTOR).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ConflictError);
    expect((error as ConflictError).code).toBe("HAS_SUBCATEGORIES");
    expect(repo.delete).not.toHaveBeenCalled();
  });

  it("goes ahead for a subcategory with nothing in it", async () => {
    const { repo } = repoWith(MENU());
    await new DeleteCategory(repo, STORAGE).execute("tea", ACTOR);
    expect(repo.delete).toHaveBeenCalledOnce();
  });
});

describe("moving among siblings", () => {
  it("moves a subcategory within its parent only", async () => {
    const { repo } = repoWith(MENU());
    await new MoveCategory(repo).execute("tea", "up", ACTOR);
    expect(repo.setOrder).toHaveBeenCalledWith("drinks", ["tea", "coffee"], expect.any(Array));
  });

  it("stops a subcategory at the end of its siblings, not the menu", async () => {
    const { repo } = repoWith(MENU());
    await expect(new MoveCategory(repo).execute("tea", "down", ACTOR)).rejects.toBeInstanceOf(ValidationError);
  });

  it("moves a top-level category among the top-level ones", async () => {
    const { repo } = repoWith(MENU());
    await new MoveCategory(repo).execute("food", "up", ACTOR);
    expect(repo.setOrder).toHaveBeenCalledWith(null, ["food", "drinks"], expect.any(Array));
  });
});

describe("ReorderCategories", () => {
  it("writes the whole order in one call and logs only the dragged category", async () => {
    const rows = [...MENU(), category("cakes", { name: "Cakes" })];
    const { repo, entries } = repoWith(rows);
    const moved = await new ReorderCategories(repo).execute(null, ["cakes", "drinks", "food"], ACTOR);

    expect(moved).toBe(1);
    expect(repo.setOrder).toHaveBeenCalledOnce();
    expect(repo.setOrder.mock.calls[0][0]).toBeNull();
    expect(repo.setOrder.mock.calls[0][1]).toEqual(["cakes", "drinks", "food"]);
    expect(entries).toEqual([
      expect.objectContaining({
        entityId: "cakes",
        entityLabel: "Cakes",
        changes: [{ field: "menuPosition", before: "3", after: "1" }],
      }),
    ]);
  });

  it("reorders one parent's subcategories", async () => {
    const { repo } = repoWith(MENU());
    await new ReorderCategories(repo).execute("drinks", ["tea", "coffee"], ACTOR);
    expect(repo.setOrder.mock.calls[0][0]).toBe("drinks");
  });

  it("writes nothing when the order didn't change", async () => {
    const { repo } = repoWith(MENU());
    expect(await new ReorderCategories(repo).execute(null, ["drinks", "food"], ACTOR)).toBe(0);
    expect(repo.setOrder).not.toHaveBeenCalled();
  });

  it("refuses ids from another parent, duplicates and an empty list", async () => {
    const { repo } = repoWith(MENU());
    const reorder = new ReorderCategories(repo);
    await expect(reorder.execute(null, ["coffee", "drinks"], ACTOR)).rejects.toBeInstanceOf(ValidationError);
    await expect(reorder.execute(null, ["food", "food"], ACTOR)).rejects.toBeInstanceOf(ValidationError);
    await expect(reorder.execute(null, [], ACTOR)).rejects.toBeInstanceOf(ValidationError);
    await expect(reorder.execute("gone", ["coffee"], ACTOR)).rejects.toBeInstanceOf(NotFoundError);
    expect(repo.setOrder).not.toHaveBeenCalled();
  });

  it("keeps a sibling the list left out after the listed ones", async () => {
    const rows = [...MENU(), category("cakes", { name: "Cakes" })];
    const { repo } = repoWith(rows);
    await new ReorderCategories(repo).execute(null, ["food", "drinks"], ACTOR);
    expect(repo.setOrder.mock.calls[0][1]).toEqual(["food", "drinks", "cakes"]);
  });
});

describe("movedIds", () => {
  it("finds the one dragged id, whichever way it went", () => {
    expect(movedIds(["a", "b", "c", "d"], ["c", "a", "b", "d"])).toEqual(["c"]);
    expect(movedIds(["a", "b", "c", "d"], ["b", "c", "d", "a"])).toEqual(["a"]);
    expect(movedIds(["a", "b"], ["a", "b"])).toEqual([]);
  });
});

describe("categoryLookup", () => {
  it("attaches each subcategory's parent so the menu rule can read it", async () => {
    const rows = MENU().map((row) => (row.id === "drinks" ? { ...row, isActive: false } : row));
    const lookup = await categoryLookup({ getAll: async () => rows });
    expect(lookup("coffee")?.parent?.isActive).toBe(false);
    expect(lookup("food")?.parent).toBeNull();
  });
});
