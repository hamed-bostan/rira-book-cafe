import { describe, expect, it, vi } from "vitest";

import { NotFoundError } from "../../../errors/NotFoundError";
import { ResourceInUseError } from "../../../errors/ResourceInUseError";
import { UniqueConstraintError } from "../../../errors/UniqueConstraintError";
import { ValidationError } from "../../../errors/ValidationError";
import { BulkUpdateCategories } from "../BulkUpdateCategories";
import { categorySnapshot } from "../categoryActivity";
import { CreateCategory } from "../CreateCategory";
import { DeleteCategory } from "../DeleteCategory";
import { GetCategories } from "../GetCategories";
import { GetCategoryById } from "../GetCategoryById";
import { GetCategoryBySlug } from "../GetCategoryBySlug";
import { GetCategoryTranslations } from "../GetCategoryTranslations";
import { MoveCategory } from "../MoveCategory";
import { UpdateCategory } from "../UpdateCategory";

import type { NewActivityEntry } from "../../../entities/ActivityEntry";
import type { Category, CategoryMoveDirection } from "../../../entities/Category";
import type { BulkCategoryUpdate, ICategoryRepository, NewCategory } from "../../../repositories/ICategoryRepository";
import type { IImageStorageRepository } from "../../../repositories/IImageStorageRepository";

const ACTOR = { id: "a1", name: "Admin" };

function category(overrides: Partial<Category> = {}): Category {
  return {
    id: "c1",
    name: "Coffee",
    slug: "coffee",
    iconUrl: "https://cdn/categories/coffee.png",
    isActive: true,
    productCount: 0,
    hiddenProductCount: 0,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    ...overrides,
  };
}

const INPUT: NewCategory = {
  name: "  Tea  ",
  slug: "  tea ",
  iconUrl: "https://cdn/categories/tea.png",
  isActive: true,
};

type Fake = {
  repo: ICategoryRepository;
  create: ReturnType<typeof vi.fn<ICategoryRepository["create"]>>;
  update: ReturnType<typeof vi.fn<ICategoryRepository["update"]>>;
  remove: ReturnType<typeof vi.fn<ICategoryRepository["delete"]>>;
  applyBulkChange: ReturnType<typeof vi.fn<ICategoryRepository["applyBulkChange"]>>;
  setOrder: ReturnType<typeof vi.fn<ICategoryRepository["setOrder"]>>;
  entries: (NewActivityEntry | null)[];
};

/** An in-memory category table whose writes run the audit hook inside "the transaction". */
function repoWith(rows: Category[]): Fake {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const entries: (NewActivityEntry | null)[] = [];

  const create = vi.fn<ICategoryRepository["create"]>(async (input, audit) => {
    const saved = category({ ...input, id: "new", isActive: input.isActive ?? true });
    if (audit) entries.push(audit(saved));
    return saved;
  });
  const update = vi.fn<ICategoryRepository["update"]>(async (id, input, audit) => {
    const current = byId.get(id) ?? category({ id });
    const saved = {
      ...current,
      name: input.name,
      slug: input.slug,
      iconUrl: input.iconUrl,
      isActive: input.isActive ?? current.isActive,
    };
    if (audit) entries.push(audit(saved));
    return saved;
  });
  const remove = vi.fn<ICategoryRepository["delete"]>(async (_id, audit) => {
    if (audit) entries.push(audit());
  });
  const applyBulkChange = vi.fn<ICategoryRepository["applyBulkChange"]>(async (ids, change, audit) => {
    const updates: BulkCategoryUpdate[] = ids
      .map((id) => byId.get(id))
      .filter((row): row is Category => row !== undefined && row[change.field] !== change.value)
      .map((previous) => ({ previous, category: { ...previous, [change.field]: change.value } }));
    if (audit) updates.forEach((u) => entries.push(audit(u)));
    return updates;
  });

  const setOrder = vi.fn<ICategoryRepository["setOrder"]>(async (_ids, audit) => {
    if (audit) entries.push(audit());
  });

  const repo: ICategoryRepository = {
    getAll: vi.fn(async () => rows),
    getById: vi.fn(async (id: string) => byId.get(id) ?? null),
    getBySlug: vi.fn(async (slug: string) => rows.find((row) => row.slug === slug) ?? null),
    create,
    update,
    delete: remove,
    getTranslations: vi.fn(async () => [{ locale: "fa", name: "قهوه" }]),
    applyBulkChange,
    setOrder,
  };
  return { repo, create, update, remove, applyBulkChange, setOrder, entries };
}

function storage(): {
  storage: IImageStorageRepository;
  removeByUrl: ReturnType<typeof vi.fn<IImageStorageRepository["removeByUrl"]>>;
} {
  const removeByUrl = vi.fn<IImageStorageRepository["removeByUrl"]>(async () => {});
  return { storage: { removeByUrl } as unknown as IImageStorageRepository, removeByUrl };
}

describe("categorySnapshot", () => {
  it("tracks name, slug, icon and active state, treating an unset isActive as active", () => {
    const { isActive: _isActive, ...withoutActive } = INPUT;
    expect(categorySnapshot(withoutActive)).toEqual({
      name: INPUT.name,
      slug: INPUT.slug,
      iconUrl: INPUT.iconUrl,
      isActive: true,
    });
    expect(categorySnapshot(category({ isActive: false })).isActive).toBe(false);
  });
});

describe("CreateCategory", () => {
  it("trims the input and records each set field as created", async () => {
    const { repo, create, entries } = repoWith([]);
    const translations = [{ locale: "fa", name: "چای" }];
    await new CreateCategory(repo).execute({ ...INPUT, translations }, ACTOR);

    expect(create.mock.calls[0][0]).toEqual({
      name: "Tea",
      slug: "tea",
      iconUrl: INPUT.iconUrl,
      isActive: true,
      translations,
    });
    expect(entries[0]).toEqual({
      actorId: "a1",
      actorName: "Admin",
      action: "category.created",
      entityType: "category",
      entityId: "new",
      entityLabel: "Tea",
      changes: [
        { field: "name", before: null, after: "Tea" },
        { field: "slug", before: null, after: "tea" },
        { field: "iconUrl", before: null, after: INPUT.iconUrl },
        { field: "isActive", before: null, after: "true" },
      ],
    });
  });

  it.each<[Partial<NewCategory>, string]>([
    [{ name: "  " }, "name"],
    [{ slug: "" }, "slug"],
    [{ iconUrl: "" }, "iconUrl"],
  ])("refuses %o", async (overrides, field) => {
    const { repo, create } = repoWith([]);
    await expect(new CreateCategory(repo).execute({ ...INPUT, ...overrides }, ACTOR)).rejects.toMatchObject({
      name: "ValidationError",
      field,
    });
    expect(create).not.toHaveBeenCalled();
  });

  it("refuses a slug that's already taken", async () => {
    const { repo, create } = repoWith([category({ slug: "tea" })]);
    await expect(new CreateCategory(repo).execute(INPUT, ACTOR)).rejects.toThrow(UniqueConstraintError);
    expect(create).not.toHaveBeenCalled();
  });
});

describe("UpdateCategory", () => {
  it("records only the fields that moved and reclaims a replaced icon", async () => {
    const previous = category({ id: "c1", name: "Coffee", slug: "coffee" });
    const { repo, entries } = repoWith([previous]);
    const { storage: images, removeByUrl } = storage();
    await new UpdateCategory(repo, images).execute("c1", { ...INPUT, slug: "coffee" }, ACTOR);

    expect(entries[0]).toMatchObject({ action: "category.updated", entityId: "c1", entityLabel: "Tea" });
    expect(entries[0]?.changes).toEqual([
      { field: "name", before: "Coffee", after: "Tea" },
      { field: "iconUrl", before: previous.iconUrl, after: INPUT.iconUrl },
    ]);
    expect(removeByUrl).toHaveBeenCalledWith(previous.iconUrl);
  });

  it("writes no entry and keeps the icon for a save that changed nothing", async () => {
    const previous = category();
    const { repo, entries } = repoWith([previous]);
    const { storage: images, removeByUrl } = storage();
    await new UpdateCategory(repo, images).execute(
      "c1",
      { name: previous.name, slug: previous.slug, iconUrl: previous.iconUrl },
      ACTOR,
    );
    expect(entries).toEqual([null]);
    expect(removeByUrl).not.toHaveBeenCalled();
  });

  it("lets a category keep its own slug but not take another's", async () => {
    const { repo, update } = repoWith([category({ id: "c1", slug: "coffee" }), category({ id: "c2", slug: "tea" })]);
    const { storage: images } = storage();
    await expect(new UpdateCategory(repo, images).execute("c1", INPUT, ACTOR)).rejects.toThrow(UniqueConstraintError);
    await new UpdateCategory(repo, images).execute("c2", INPUT, ACTOR);
    expect(update).toHaveBeenCalledOnce();
  });

  it("is not found for an unknown id", async () => {
    const { repo, update } = repoWith([]);
    await expect(new UpdateCategory(repo, storage().storage).execute("missing", INPUT, ACTOR)).rejects.toThrow(
      NotFoundError,
    );
    expect(update).not.toHaveBeenCalled();
  });

  it.each<[string, Partial<NewCategory>, string]>([
    ["", {}, "id"],
    ["c1", { name: " " }, "name"],
    ["c1", { slug: " " }, "slug"],
    ["c1", { iconUrl: "" }, "iconUrl"],
  ])("refuses id %j with %o", async (id, overrides, field) => {
    const { repo } = repoWith([category()]);
    await expect(
      new UpdateCategory(repo, storage().storage).execute(id, { ...INPUT, ...overrides }, ACTOR),
    ).rejects.toMatchObject({ field });
  });
});

describe("DeleteCategory", () => {
  it("records every field going away and reclaims the icon", async () => {
    const existing = category();
    const { repo, remove, entries } = repoWith([existing]);
    const { storage: images, removeByUrl } = storage();
    await new DeleteCategory(repo, images).execute("c1", ACTOR);

    expect(remove.mock.calls[0][0]).toBe("c1");
    expect(entries[0]).toEqual({
      actorId: "a1",
      actorName: "Admin",
      action: "category.deleted",
      entityType: "category",
      entityId: "c1",
      entityLabel: "Coffee",
      changes: [
        { field: "name", before: "Coffee", after: null },
        { field: "slug", before: "coffee", after: null },
        { field: "iconUrl", before: existing.iconUrl, after: null },
        { field: "isActive", before: "true", after: null },
      ],
    });
    expect(removeByUrl).toHaveBeenCalledWith(existing.iconUrl);
  });

  it("refuses a category that still has products, naming how many", async () => {
    const { repo, remove } = repoWith([
      category({ productCount: 1 }),
      category({ id: "c2", name: "Tea", productCount: 3 }),
    ]);
    const images = storage().storage;
    await expect(new DeleteCategory(repo, images).execute("c1", ACTOR)).rejects.toThrow(/1 product assigned/);
    await expect(new DeleteCategory(repo, images).execute("c2", ACTOR)).rejects.toThrow(/3 products assigned/);
    await expect(new DeleteCategory(repo, images).execute("c2", ACTOR)).rejects.toThrow(ResourceInUseError);
    expect(remove).not.toHaveBeenCalled();
  });

  it("refuses a missing id and an unknown one", async () => {
    const { repo } = repoWith([]);
    const images = storage().storage;
    await expect(new DeleteCategory(repo, images).execute("", ACTOR)).rejects.toThrow(ValidationError);
    await expect(new DeleteCategory(repo, images).execute("missing", ACTOR)).rejects.toThrow(NotFoundError);
  });
});

describe("BulkUpdateCategories", () => {
  it("returns only the categories that changed, each with its own entry", async () => {
    const { repo, entries } = repoWith([
      category({ id: "c1", isActive: true }),
      category({ id: "c2", name: "Tea", isActive: false }),
    ]);
    const changed = await new BulkUpdateCategories(repo).execute(
      ["c1", "c2", "missing"],
      { field: "isActive", value: false },
      ACTOR,
    );

    expect(changed.map((c) => c.id)).toEqual(["c1"]);
    expect(entries).toEqual([
      {
        actorId: "a1",
        actorName: "Admin",
        action: "category.updated",
        entityType: "category",
        entityId: "c1",
        entityLabel: "Coffee",
        changes: [{ field: "isActive", before: "true", after: "false" }],
      },
    ]);
  });

  it("refuses an empty selection and one that's too large", async () => {
    const { repo, applyBulkChange } = repoWith([]);
    const useCase = new BulkUpdateCategories(repo);
    await expect(useCase.execute([], { field: "isActive", value: true }, ACTOR)).rejects.toThrow(ValidationError);
    await expect(
      useCase.execute(
        Array.from({ length: 201 }, (_, i) => `c${i}`),
        { field: "isActive", value: true },
        ACTOR,
      ),
    ).rejects.toThrow("at most 200");
    expect(applyBulkChange).not.toHaveBeenCalled();
  });
});

describe("MoveCategory", () => {
  const menu = (): Category[] => [
    category({ id: "c1", name: "Coffee" }),
    category({ id: "c2", name: "Tea" }),
    category({ id: "c3", name: "Cakes" }),
  ];

  it("swaps a category with the one above it and records its new place", async () => {
    const { repo, setOrder, entries } = repoWith(menu());
    await new MoveCategory(repo).execute("c2", "up", ACTOR);

    expect(setOrder.mock.calls[0][0]).toEqual(["c2", "c1", "c3"]);
    expect(entries).toEqual([
      {
        actorId: ACTOR.id,
        actorName: ACTOR.name,
        action: "category.updated",
        entityType: "category",
        entityId: "c2",
        entityLabel: "Tea",
        changes: [{ field: "position", before: "2", after: "1" }],
      },
    ]);
  });

  it("swaps a category with the one below it", async () => {
    const { repo, setOrder } = repoWith(menu());
    await new MoveCategory(repo).execute("c2", "down", ACTOR);
    expect(setOrder.mock.calls[0][0]).toEqual(["c1", "c3", "c2"]);
  });

  it.each<[string, CategoryMoveDirection]>([
    ["c1", "up"],
    ["c3", "down"],
  ])("refuses to move %s %s past the end of the menu", async (id, direction) => {
    const { repo, setOrder } = repoWith(menu());
    await expect(new MoveCategory(repo).execute(id, direction, ACTOR)).rejects.toBeInstanceOf(ValidationError);
    expect(setOrder).not.toHaveBeenCalled();
  });

  it("is a not-found for a category that doesn't exist", async () => {
    const { repo, setOrder } = repoWith(menu());
    await expect(new MoveCategory(repo).execute("nope", "up", ACTOR)).rejects.toBeInstanceOf(NotFoundError);
    expect(setOrder).not.toHaveBeenCalled();
  });
});

describe("category queries", () => {
  it("delegate to the repository with the locale", async () => {
    const coffee = category();
    const { repo } = repoWith([coffee]);
    expect(await new GetCategories(repo).execute("fa")).toEqual([coffee]);
    expect(repo.getAll).toHaveBeenCalledWith("fa");
    expect(await new GetCategoryById(repo).execute("c1", "en")).toBe(coffee);
    expect(repo.getById).toHaveBeenCalledWith("c1", "en");
    expect(await new GetCategoryBySlug(repo).execute("coffee")).toBe(coffee);
    expect(await new GetCategoryBySlug(repo).execute("nope")).toBeNull();
    expect(await new GetCategoryTranslations(repo).execute("c1")).toEqual([{ locale: "fa", name: "قهوه" }]);
  });
});
