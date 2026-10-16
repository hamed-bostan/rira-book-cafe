import { Prisma } from "@prisma/client";

import type { AdminCategoryFilters, AdminCategorySort } from "@/src/domain/entities/AdminCategoryFilters";
import type { Category } from "@/src/domain/entities/Category";
import { createPage, toSkipTake, type Page, type PageRequest } from "@/src/domain/entities/Pagination";
import { NotFoundError } from "@/src/domain/errors/NotFoundError";
import { UniqueConstraintError } from "@/src/domain/errors/UniqueConstraintError";
import type { AuditHook } from "@/src/domain/repositories/AuditHook";
import type {
  BulkCategoryChange,
  BulkCategoryUpdate,
  CategoryTranslationInput,
  ICategoryRepository,
  NewCategory,
} from "@/src/domain/repositories/ICategoryRepository";
import { prisma } from "@/src/infrastructure/prisma/client";

import { recordAudit } from "./writeActivityEntry";

/**
 * Categories backed by PostgreSQL via Prisma. Server-side only (it opens a DB
 * connection), bound through the container — never imported by client code.
 */
export class PrismaCategoryRepository implements ICategoryRepository {
  async getAll(locale?: string): Promise<Category[]> {
    const rows = await prisma.category.findMany({ orderBy: { createdAt: "asc" } });
    const categories = await withProductCounts(rows.map(toCategory));
    return localizeCategories(categories, locale);
  }

  /**
   * One page of the category-management list.
   *
   * `productCount` isn't a column, so ordering by it can't be pushed into the
   * query. Ordering by `name` also can't be pushed down once a `locale` is in
   * play: the visible name is `localizeCategories`'s overlay, and sorting by
   * the canonical column first would order fa results by their English name.
   * Both cases fetch every match, sort in memory once counts (and, for `name`,
   * translations) are attached, then slice — the category table is small
   * enough, an operator's hand-authored taxonomy rather than a generated one,
   * that this stays cheap.
   *
   * `updatedAt`, and `name` with no locale (the base-locale admin view), sort
   * on a real column with nothing overlaid afterward, so the DB does the
   * ordering and paging directly and counts are only computed for the rows
   * actually returned.
   */
  async listPage(
    filters: AdminCategoryFilters,
    page: PageRequest<AdminCategorySort>,
    locale?: string,
  ): Promise<Page<Category>> {
    const where = adminWhere(filters);
    const sort = page.sort ?? "name";
    const canPushSort = sort === "updatedAt" || (sort === "name" && !locale);

    if (!canPushSort) {
      const rows = await prisma.category.findMany({ where });
      const categories = await localizeCategories(await withProductCounts(rows.map(toCategory)), locale);
      const sorted = categories.slice().sort(adminComparator(page));
      const { skip, take } = toSkipTake(page);
      return createPage(sorted.slice(skip, skip + take), sorted.length, page);
    }

    const { skip, take } = toSkipTake(page);
    const direction = page.direction === "desc" ? "desc" : "asc";
    const [rows, total] = await Promise.all([
      prisma.category.findMany({ where, orderBy: { [sort]: direction }, skip, take }),
      prisma.category.count({ where }),
    ]);
    const categories = await localizeCategories(await withProductCounts(rows.map(toCategory)), locale);
    return createPage(categories, total, page);
  }

  async getById(id: string, locale?: string): Promise<Category | null> {
    const row = await prisma.category.findUnique({ where: { id } });
    if (!row) return null;
    const [category] = await withProductCounts([toCategory(row)]);
    return (await localizeCategories([category], locale))[0];
  }

  async getBySlug(slug: string, locale?: string): Promise<Category | null> {
    const row = await prisma.category.findUnique({ where: { slug } });
    if (!row) return null;
    const [category] = await withProductCounts([toCategory(row)]);
    return (await localizeCategories([category], locale))[0];
  }

  async create(input: NewCategory, audit?: AuditHook<Category>): Promise<Category> {
    // `translations` isn't a `categories` column — persist it into the side table.
    const { translations, ...data } = input;
    try {
      const row = await prisma.$transaction(async (tx) => {
        const created = await tx.category.create({ data });
        // `productCount` is a placeholder here: the audit hook (see `categorySnapshot`)
        // never reads it, and a fresh row has nothing referencing it yet anyway.
        await recordAudit(tx, { ...toCategory(created), productCount: 0 }, audit);
        return created;
      });
      await replaceCategoryTranslations(row.id, translations);
      return { ...toCategory(row), productCount: 0 };
    } catch (error) {
      throw toDomainError(error);
    }
  }

  async update(id: string, input: NewCategory, audit?: AuditHook<Category>): Promise<Category> {
    const { translations, ...data } = input;
    try {
      const row = await prisma.$transaction(async (tx) => {
        const updated = await tx.category.update({ where: { id }, data });
        // `productCount` is a placeholder — the audit hook's `categorySnapshot` never reads it.
        await recordAudit(tx, { ...toCategory(updated), productCount: 0 }, audit);
        return updated;
      });
      await replaceCategoryTranslations(row.id, translations);
      const [category] = await withProductCounts([toCategory(row)]);
      return category;
    } catch (error) {
      throw toDomainError(error);
    }
  }

  async getTranslations(categoryId: string): Promise<CategoryTranslationInput[]> {
    const rows = await prisma.categoryTranslation.findMany({
      where: { categoryId },
      orderBy: { locale: "asc" },
    });
    return rows.map((row) => ({ locale: row.locale, name: row.name }));
  }

  async delete(id: string, audit?: AuditHook<void>): Promise<void> {
    try {
      // Transactional: the entry is the only surviving record of the category.
      await prisma.$transaction(async (tx) => {
        await tx.category.delete({ where: { id } });
        await recordAudit(tx, undefined, audit);
      });
    } catch (error) {
      throw toDomainError(error);
    }
  }

  /** Mirrors `PrismaProductRepository.applyBulkChange` — see that method for the shape's rationale. */
  async applyBulkChange(
    ids: readonly string[],
    change: BulkCategoryChange,
    audit?: AuditHook<BulkCategoryUpdate>,
  ): Promise<BulkCategoryUpdate[]> {
    if (ids.length === 0) return [];

    return prisma.$transaction(async (tx) => {
      const targets = await tx.category.findMany({
        where: { id: { in: [...ids] }, NOT: { [change.field]: change.value } },
      });
      if (targets.length === 0) return [];

      const targetIds = targets.map((row) => row.id);
      await tx.category.updateMany({
        where: { id: { in: targetIds } },
        data: { [change.field]: change.value },
      });

      const written = await tx.category.findMany({ where: { id: { in: targetIds } } });
      const counts = await tx.product.groupBy({
        by: ["categoryId"],
        where: { categoryId: { in: targetIds } },
        _count: { _all: true },
      });
      const countById = new Map(counts.map((row) => [row.categoryId, row._count._all]));
      const previousById = new Map(
        targets.map((row) => [row.id, { ...toCategory(row), productCount: countById.get(row.id) ?? 0 }]),
      );

      const updates: BulkCategoryUpdate[] = written.map((row) => ({
        category: { ...toCategory(row), productCount: countById.get(row.id) ?? 0 },
        previous: previousById.get(row.id)!,
      }));

      // One entry per category, inside the same transaction as the writes — so the
      // batch is atomic and each category's own activity panel explains its state.
      for (const update of updates) {
        await recordAudit(tx, update, audit);
      }

      return updates;
    });
  }
}

/**
 * Map a Prisma row to the domain entity. `productCount` isn't a column on this
 * row — every caller must run the result through {@link withProductCounts}
 * (or, for a just-created row, knows it's zero) before returning it.
 */
function toCategory(row: {
  id: string;
  name: string;
  slug: string;
  iconUrl: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}): Omit<Category, "productCount"> {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    iconUrl: row.iconUrl,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * Attach each category's live product count. `categoryId` is a plain field,
 * not a Prisma relation (see the schema comment — products and categories
 * stay loosely coupled), so this is a manual `groupBy` rather than an
 * `_count` include.
 */
async function withProductCounts(categories: Omit<Category, "productCount">[]): Promise<Category[]> {
  if (categories.length === 0) return [];

  const counts = await prisma.product.groupBy({
    by: ["categoryId"],
    where: { categoryId: { in: categories.map((c) => c.id) } },
    _count: { _all: true },
  });
  const countById = new Map(counts.map((row) => [row.categoryId, row._count._all]));
  return categories.map((category) => ({ ...category, productCount: countById.get(category.id) ?? 0 }));
}

/** `WHERE` for the management list — name search and active/inactive status, both optional. */
function adminWhere(filters: AdminCategoryFilters): Prisma.CategoryWhereInput {
  const and: Prisma.CategoryWhereInput[] = [];

  if (filters.query) and.push({ name: { contains: filters.query, mode: "insensitive" } });
  if (filters.status) and.push({ isActive: filters.status === "active" });

  return and.length ? { AND: and } : {};
}

/** In-memory comparator for the management list's sort — see `listPage` for why this isn't a DB `ORDER BY`. */
function adminComparator(page: PageRequest<AdminCategorySort>): (a: Category, b: Category) => number {
  const direction = page.direction === "desc" ? -1 : 1;
  return (a, b) => {
    switch (page.sort) {
      case "productCount":
        return (a.productCount - b.productCount) * direction;
      case "updatedAt":
        return (a.updatedAt.getTime() - b.updatedAt.getTime()) * direction;
      default:
        return a.name.localeCompare(b.name) * direction;
    }
  };
}

/**
 * Persist a category's per-locale translations to the side table. `undefined` leaves
 * them untouched; a list replaces the set — locales absent from it are deleted (so
 * `[]` clears all), the rest upserted.
 */
async function replaceCategoryTranslations(
  categoryId: string,
  translations?: CategoryTranslationInput[],
): Promise<void> {
  if (translations === undefined) return;

  const locales = translations.map((t) => t.locale);
  const where: Prisma.CategoryTranslationWhereInput = { categoryId };
  if (locales.length > 0) where.locale = { notIn: locales };

  // One atomic batch — the delete and the upserts land together or not at all, so a
  // failure mid-way can't leave the translation set half-replaced.
  await prisma.$transaction([
    prisma.categoryTranslation.deleteMany({ where }),
    ...translations.map((t) =>
      prisma.categoryTranslation.upsert({
        where: { categoryId_locale: { categoryId, locale: t.locale } },
        create: { categoryId, locale: t.locale, name: t.name },
        update: { name: t.name },
      }),
    ),
  ]);
}

/**
 * Overlay per-locale translations onto canonical categories. For the default locale
 * (no `locale` passed) the base names are returned as-is; otherwise a category's
 * translated `name` replaces the canonical one, falling back to the base name when no
 * translation row exists.
 */
async function localizeCategories(categories: Category[], locale?: string): Promise<Category[]> {
  if (!locale || categories.length === 0) return categories;

  const translations = await prisma.categoryTranslation.findMany({
    where: { locale, categoryId: { in: categories.map((c) => c.id) } },
  });
  if (translations.length === 0) return categories;

  const nameById = new Map(translations.map((t) => [t.categoryId, t.name]));
  return categories.map((category) => {
    const name = nameById.get(category.id);
    return name ? { ...category, name } : category;
  });
}

/**
 * Translate Prisma's unique-violation (P2002) into a transport-agnostic domain
 * error so callers never branch on Prisma codes; every other error passes through.
 */
function toDomainError(error: unknown): unknown {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    // P2002: unique violation. P2025: the targeted row no longer exists (lost a
    // race between a pre-write existence check and the write).
    if (error.code === "P2002") return new UniqueConstraintError(uniqueTargetFields(error), { cause: error });
    if (error.code === "P2025") return new NotFoundError("category", undefined, { cause: error });
  }
  return error;
}

/** Best-effort extraction of the offending field names from a P2002 `meta.target`. */
function uniqueTargetFields(error: Prisma.PrismaClientKnownRequestError): string[] {
  const target = error.meta?.target;
  if (Array.isArray(target)) return target.map(String);
  if (typeof target === "string") return [target];
  return [];
}
