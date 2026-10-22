import type { Category } from "@/src/domain/entities/Category";
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
import { Prisma } from "@/src/infrastructure/prisma/generated/client";

import { recordAudit } from "./writeActivityEntry";

/**
 * Categories backed by PostgreSQL via Prisma. Server-side only (it opens a DB
 * connection), bound through the container — never imported by client code.
 */
export class PrismaCategoryRepository implements ICategoryRepository {
  async getAll(locale?: string): Promise<Category[]> {
    const rows = await prisma.category.findMany({ orderBy: MENU_ORDER });
    const categories = await withProductCounts(rows.map(toCategory));
    return localizeCategories(categories, locale);
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
        // A new category goes to the end of the menu.
        const last = await tx.category.aggregate({ _max: { position: true } });
        const created = await tx.category.create({ data: { ...data, position: (last._max.position ?? -1) + 1 } });
        // The counts are placeholders here: the audit hook (see `categorySnapshot`)
        // never reads them, and a fresh row has nothing referencing it yet anyway.
        await recordAudit(tx, { ...toCategory(created), ...NO_PRODUCTS }, audit);
        return created;
      });
      await replaceCategoryTranslations(row.id, translations);
      return { ...toCategory(row), ...NO_PRODUCTS };
    } catch (error) {
      throw toDomainError(error);
    }
  }

  async update(id: string, input: NewCategory, audit?: AuditHook<Category>): Promise<Category> {
    const { translations, ...data } = input;
    try {
      const row = await prisma.$transaction(async (tx) => {
        const updated = await tx.category.update({ where: { id }, data });
        // The counts are placeholders — the audit hook's `categorySnapshot` never reads them.
        await recordAudit(tx, { ...toCategory(updated), ...NO_PRODUCTS }, audit);
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

  async setOrder(ids: readonly string[], audit?: AuditHook<void>): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const current = await tx.category.findMany({ orderBy: MENU_ORDER, select: { id: true } });
      const existing = new Set(current.map((row) => row.id));
      const listed = new Set(ids);
      const order = [
        ...ids.filter((id) => existing.has(id)),
        ...current.map((row) => row.id).filter((id) => !listed.has(id)),
      ];
      // One statement, in raw SQL so a reorder doesn't stamp every category's
      // `updatedAt`: moving Tea above Coffee hasn't edited either of them.
      await tx.$executeRaw`
        UPDATE "categories" AS c
        SET "position" = o.ordinality - 1
        FROM unnest(${order}::text[]) WITH ORDINALITY AS o(id, ordinality)
        WHERE c."id" = o.id AND c."position" <> o.ordinality - 1`;
      await recordAudit(tx, undefined, audit);
    });
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
      const countsById = await productCountsById(tx, targetIds);
      const previousById = new Map(
        targets.map((row) => [row.id, { ...toCategory(row), ...(countsById.get(row.id) ?? NO_PRODUCTS) }]),
      );

      const updates: BulkCategoryUpdate[] = written.map((row) => ({
        category: { ...toCategory(row), ...(countsById.get(row.id) ?? NO_PRODUCTS) },
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

/** Menu order: by position, and by age where two share one (a create racing another). */
const MENU_ORDER: Prisma.CategoryOrderByWithRelationInput[] = [{ position: "asc" }, { createdAt: "asc" }];

/** The derived counts — not columns on a category row. */
type ProductCounts = Pick<Category, "productCount" | "hiddenProductCount">;

/** A category nothing references yet. */
const NO_PRODUCTS: ProductCounts = { productCount: 0, hiddenProductCount: 0 };

/**
 * Map a Prisma row to the domain entity. The product counts aren't columns on
 * this row — every caller must run the result through {@link withProductCounts}
 * (or, for a just-created row, knows they're zero) before returning it.
 */
function toCategory(row: {
  id: string;
  name: string;
  slug: string;
  iconUrl: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}): Omit<Category, keyof ProductCounts> {
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
 * Attach each category's live product counts — all of its products, and how many
 * of those are hidden from the menu.
 */
async function withProductCounts(categories: Omit<Category, keyof ProductCounts>[]): Promise<Category[]> {
  if (categories.length === 0) return [];

  const countsById = await productCountsById(
    prisma,
    categories.map((c) => c.id),
  );
  return categories.map((category) => ({ ...category, ...(countsById.get(category.id) ?? NO_PRODUCTS) }));
}

/**
 * Count the products in each category, and the unpublished ones among them.
 * `categoryId` is a plain field, not a Prisma relation (see the schema comment —
 * products and categories stay loosely coupled), so this is a manual `groupBy`
 * rather than an `_count` include.
 */
async function productCountsById(
  db: Prisma.TransactionClient | typeof prisma,
  categoryIds: string[],
): Promise<Map<string, ProductCounts>> {
  const groups = await db.product.groupBy({
    by: ["categoryId", "isPublished"],
    where: { categoryId: { in: categoryIds } },
    _count: { _all: true },
  });
  const countsById = new Map<string, ProductCounts>();
  for (const group of groups) {
    const counts = countsById.get(group.categoryId) ?? { ...NO_PRODUCTS };
    counts.productCount += group._count._all;
    if (!group.isPublished) counts.hiddenProductCount += group._count._all;
    countsById.set(group.categoryId, counts);
  }
  return countsById;
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
