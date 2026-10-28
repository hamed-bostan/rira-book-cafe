import type { AdminProductFilters, AdminProductSort } from "@/src/domain/entities/AdminProductFilters";
import { DEFAULT_ADMIN_PRODUCT_DIRECTION } from "@/src/domain/entities/AdminProductFilters";
import { ingredientAlertFor } from "@/src/domain/entities/Inventory";
import { createPage, toSkipTake, type Page, type PageRequest } from "@/src/domain/entities/Pagination";
import {
  BOOK_AVAILABILITIES,
  PRODUCT_KINDS,
  type BookAvailability,
  type BookDetails,
  type Product,
  type ProductKind,
  type ProductListItem,
} from "@/src/domain/entities/Product";
import type { ProductFilters, ProductSort } from "@/src/domain/entities/ProductFilters";
import { LOW_STOCK_THRESHOLD } from "@/src/domain/entities/stock";
import { NotFoundError } from "@/src/domain/errors/NotFoundError";
import type { AuditHook } from "@/src/domain/repositories/AuditHook";
import type {
  BulkProductChange,
  BulkProductUpdate,
  IProductRepository,
  NewProduct,
  ProductTranslationInput,
} from "@/src/domain/repositories/IProductRepository";
import { prisma } from "@/src/infrastructure/prisma/client";
import { Prisma } from "@/src/infrastructure/prisma/generated/client";
import { inTransaction, type PrismaDb } from "@/src/infrastructure/prisma/transaction";

import { recordAudit } from "./writeActivityEntry";

/**
 * The visibility predicate every public read carries, written once so no query
 * can quietly forget it.
 */
const PUBLISHED = { isPublished: true } satisfies Prisma.ProductWhereInput;

/**
 * The management list's rows come with their recipe's ingredients — just what a
 * made-to-order item's warning is read from — in the same query as the page.
 */
const WITH_RECIPE_STOCK = {
  recipeLines: { select: { ingredient: { select: { name: true, onHand: true, reorderLevel: true } } } },
} satisfies Prisma.ProductInclude;

/**
 * Menu items backed by PostgreSQL via Prisma. Server-side only (it opens a DB
 * connection), bound through the container — never imported by client code.
 */
export class PrismaProductRepository implements IProductRepository {
  /**
   * `db` is the root client for ordinary calls and a transaction client when the
   * repository joins a wider transaction. Every statement goes through it.
   */
  constructor(private readonly db: PrismaDb = prisma) {}

  async getAll(locale?: string): Promise<Product[]> {
    const rows = await this.db.product.findMany({ where: PUBLISHED, orderBy: { createdAt: "asc" } });
    return localizeProducts(rows.map(toProduct), locale);
  }

  async getById(id: string, locale?: string): Promise<Product | null> {
    const row = await this.db.product.findUnique({ where: { id } });
    if (!row) return null;
    return (await localizeProducts([toProduct(row)], locale))[0];
  }

  async getPublishedById(id: string, locale?: string): Promise<Product | null> {
    // `findFirst`, not `findUnique`: the lookup is by id *and* visibility. An
    // unpublished item resolves to `null`, indistinguishable from a missing one.
    const row = await this.db.product.findFirst({ where: { ...PUBLISHED, id } });
    if (!row) return null;
    return (await localizeProducts([toProduct(row)], locale))[0];
  }

  async getByIds(ids: readonly string[], locale?: string): Promise<Product[]> {
    if (ids.length === 0) return [];
    const rows = await this.db.product.findMany({ where: { id: { in: [...ids] } } });
    return localizeProducts(rows.map(toProduct), locale);
  }

  async getFeatured(locale?: string): Promise<Product[]> {
    const rows = await this.db.product.findMany({
      where: { ...PUBLISHED, isFeatured: true },
      orderBy: { createdAt: "asc" },
    });
    return localizeProducts(rows.map(toProduct), locale);
  }

  async search(filters: ProductFilters, locale?: string): Promise<Product[]> {
    // Each supplied filter is one AND clause; the text term matches name,
    // description or author (case-insensitive), dietary matches ANY of its values.
    const and: Prisma.ProductWhereInput[] = [PUBLISHED];

    if (filters.query) {
      const or: Prisma.ProductWhereInput[] = textMatch(filters.query);
      // Also match the localized text so a search in the active language finds the
      // item. Translations live in a side table with no Prisma relation, so resolve
      // the matching ids first, then widen the OR by id.
      if (locale) {
        const matches = await this.db.productTranslation.findMany({
          where: {
            locale,
            OR: [
              { name: { contains: filters.query, mode: "insensitive" } },
              { description: { contains: filters.query, mode: "insensitive" } },
            ],
          },
          select: { productId: true },
        });
        if (matches.length > 0) or.push({ id: { in: matches.map((m) => m.productId) } });
      }
      and.push({ OR: or });
    }
    if (filters.categoryId) and.push({ categoryId: filters.categoryId });
    if (filters.kind) and.push({ kind: filters.kind });
    if (filters.minPrice != null) and.push({ price: { gte: filters.minPrice } });
    if (filters.maxPrice != null) and.push({ price: { lte: filters.maxPrice } });
    if (filters.dietary?.length) and.push({ dietary: { hasSome: filters.dietary } });

    const rows = await this.db.product.findMany({
      where: { AND: and },
      orderBy: orderByFor(filters.sort),
    });
    return localizeProducts(rows.map(toProduct), locale);
  }

  async listPage(
    filters: AdminProductFilters,
    page: PageRequest<AdminProductSort>,
    locale?: string,
  ): Promise<Page<ProductListItem>> {
    const where = await adminWhere(this.db, filters, locale);
    const { skip, take } = toSkipTake(page);

    // One transaction so the rows and the count are read from the same snapshot.
    const [rows, total] = await inTransaction(this.db, (tx) =>
      Promise.all([
        tx.product.findMany({ where, orderBy: adminOrderBy(page), skip, take, include: WITH_RECIPE_STOCK }),
        tx.product.count({ where }),
      ]),
    );

    return createPage(await localizeProducts(rows.map(toListItem), locale), total, page);
  }

  async create(input: NewProduct, audit?: AuditHook<Product>): Promise<Product> {
    // `translations` isn't a `products` column — persist it into the side table.
    const { translations, ...product } = input;
    try {
      const row = await inTransaction(this.db, async (tx) => {
        const created = await tx.product.create({ data: toRowData(product) });
        // Inside the transaction, so the audit entry and the item it records commit together.
        await recordAudit(tx, toProduct(created), audit);
        await replaceProductTranslations(tx, created.id, translations);
        return created;
      });
      return toProduct(row);
    } catch (error) {
      throw toDomainError(error);
    }
  }

  async update(id: string, input: NewProduct, audit?: AuditHook<Product>): Promise<Product> {
    const { translations, ...product } = input;
    try {
      const row = await inTransaction(this.db, async (tx) => {
        const updated = await tx.product.update({ where: { id }, data: toRowData(product) });
        await recordAudit(tx, toProduct(updated), audit);
        await replaceProductTranslations(tx, id, translations);
        return updated;
      });
      return toProduct(row);
    } catch (error) {
      throw toDomainError(error);
    }
  }

  async getTranslations(productId: string): Promise<ProductTranslationInput[]> {
    const rows = await this.db.productTranslation.findMany({
      where: { productId },
      orderBy: { locale: "asc" },
    });
    return rows.map((row) => ({
      locale: row.locale,
      name: row.name,
      unit: row.unit ?? undefined,
      description: row.description ?? undefined,
      nutrition: row.nutrition ?? undefined,
      origin: row.origin ?? undefined,
    }));
  }

  async delete(id: string, audit?: AuditHook<void>): Promise<void> {
    try {
      // Transactional even though it is a single delete: the audit entry is the
      // only record the item ever existed. Its translations go with it.
      await inTransaction(this.db, async (tx) => {
        await tx.product.delete({ where: { id } });
        await tx.productTranslation.deleteMany({ where: { productId: id } });
        await recordAudit(tx, undefined, audit);
      });
    } catch (error) {
      throw toDomainError(error);
    }
  }

  async applyBulkChange(
    ids: readonly string[],
    change: BulkProductChange,
    audit?: AuditHook<BulkProductUpdate>,
  ): Promise<BulkProductUpdate[]> {
    if (ids.length === 0) return [];

    return inTransaction(this.db, async (tx) => {
      // Read the rows *before* writing, narrowed to the ones the change would
      // actually move — so each audit entry carries a real "before", no-ops record
      // nothing, and ids deleted in another tab are silently skipped.
      const targets = await tx.product.findMany({
        where: { id: { in: [...ids] }, NOT: { [change.field]: change.value } },
      });
      if (targets.length === 0) return [];

      const targetIds = targets.map((row) => row.id);
      await tx.product.updateMany({
        where: { id: { in: targetIds } },
        data: { [change.field]: change.value },
      });

      const written = await tx.product.findMany({ where: { id: { in: targetIds } } });
      const previousById = new Map(targets.map((row) => [row.id, toProduct(row)]));

      const updates: BulkProductUpdate[] = written.flatMap((row) => {
        const previous = previousById.get(row.id);
        return previous ? [{ product: toProduct(row), previous }] : [];
      });

      // One entry per item, inside the same transaction as the writes.
      for (const update of updates) {
        await recordAudit(tx, update, audit);
      }

      return updates;
    });
  }
}

/** Text match over the canonical columns: name, description, and a book's author. */
function textMatch(query: string): Prisma.ProductWhereInput[] {
  return [
    { name: { contains: query, mode: "insensitive" } },
    { description: { contains: query, mode: "insensitive" } },
    { bookAuthor: { contains: query, mode: "insensitive" } },
  ];
}

/**
 * Ids of the categories whose name holds `query` — the canonical name, or the
 * active locale's, which is the one the dashboard's tabs show. Categories have no
 * Prisma relation to products, so they're resolved first and matched by id.
 */
async function categoryIdsNamed(db: PrismaDb, query: string, locale?: string): Promise<string[]> {
  const nameHolds = { contains: query, mode: "insensitive" } satisfies Prisma.StringFilter;
  const [canonical, translated] = await Promise.all([
    db.category.findMany({ where: { name: nameHolds }, select: { id: true } }),
    locale
      ? db.categoryTranslation.findMany({ where: { locale, name: nameHolds }, select: { categoryId: true } })
      : Promise.resolve([]),
  ]);
  return [...new Set([...canonical.map((row) => row.id), ...translated.map((row) => row.categoryId)])];
}

/**
 * The management list's text match: what a row shows — the item's name, its
 * author and size (the line under the name), its description — and the name of
 * its category, so "cakes" finds every cake.
 */
async function adminTextMatch(db: PrismaDb, query: string, locale?: string): Promise<Prisma.ProductWhereInput[]> {
  const categoryIds = await categoryIdsNamed(db, query, locale);
  return [
    ...textMatch(query),
    { unit: { contains: query, mode: "insensitive" } },
    ...(categoryIds.length > 0 ? [{ categoryId: { in: categoryIds } }] : []),
  ];
}

/**
 * `WHERE` for the management list. Unlike the public search, an empty filter is
 * legitimate and matches everything. The text term matches the item's canonical
 * columns — an operator searching here is looking for the row they'd edit — and
 * its category's name.
 */
async function adminWhere(
  db: PrismaDb,
  filters: AdminProductFilters,
  locale?: string,
): Promise<Prisma.ProductWhereInput> {
  const and: Prisma.ProductWhereInput[] = [];

  if (filters.query) and.push({ OR: await adminTextMatch(db, filters.query, locale) });
  if (filters.categoryId) and.push({ categoryId: filters.categoryId });
  if (filters.kind) and.push({ kind: filters.kind });

  // Bounds mirror `getStockStatus` exactly, so "low" means the same row everywhere —
  // and, as there, a made-to-order item is never out, low or in by count.
  if (filters.stock === "out") and.push({ ...COUNTED, stockQuantity: { lte: 0 } });
  if (filters.stock === "low") and.push({ ...COUNTED, stockQuantity: { gt: 0, lte: LOW_STOCK_THRESHOLD } });
  if (filters.stock === "in") and.push({ ...COUNTED, stockQuantity: { gt: LOW_STOCK_THRESHOLD } });
  // Low or out: by count for a counted item; for a made-to-order one, by an
  // ingredient of its recipe — the rows that come back with an `ingredientAlert`.
  if (filters.stock === "needsRestock") {
    and.push({
      OR: [
        { ...COUNTED, stockQuantity: { lte: LOW_STOCK_THRESHOLD } },
        { madeToOrder: true, recipeLines: { some: { ingredient: ingredientNeedsRestock(db) } } },
      ],
    });
  }

  // No clause when absent: the list deliberately shows both visibility states together.
  if (filters.visibility) and.push({ isPublished: filters.visibility === "published" });

  return and.length ? { AND: and } : {};
}

/** Items whose count is kept — everything but made-to-order. */
const COUNTED = { madeToOrder: false } satisfies Prisma.ProductWhereInput;

/**
 * An ingredient out or running low, with the bounds of `stockLevel`: out at zero
 * or below, low at or below its reorder level (never, without one — comparing to
 * a null level matches nothing).
 */
function ingredientNeedsRestock(db: PrismaDb): Prisma.IngredientWhereInput {
  return { OR: [{ onHand: { lte: 0 } }, { onHand: { lte: db.ingredient.fields.reorderLevel } }] };
}

/** `ORDER BY` for the management list, on canonical columns. */
function adminOrderBy(page: PageRequest<AdminProductSort>): Prisma.ProductOrderByWithRelationInput {
  const direction = page.direction ?? DEFAULT_ADMIN_PRODUCT_DIRECTION;
  switch (page.sort) {
    case "name":
      return { name: direction };
    case "price":
      return { price: direction };
    case "stock":
      return { stockQuantity: direction };
    default:
      return { createdAt: direction };
  }
}

function orderByFor(sort: ProductSort | undefined): Prisma.ProductOrderByWithRelationInput {
  switch (sort) {
    case "price-asc":
      return { price: "asc" };
    case "price-desc":
      return { price: "desc" };
    case "rating":
      return { rating: "desc" };
    default:
      return { name: "asc" };
  }
}

/**
 * The writable columns for an item. Book columns are written only for books and
 * cleared otherwise, so switching an item away from "book" can't leave a stale
 * author behind. An absent `stockQuantity` (a made-to-order item) is left out of
 * the write, so the stored count stays as it was — the column default on create.
 */
function toRowData(product: Omit<NewProduct, "translations">) {
  const { book, ...rest } = product;
  const isBook = product.kind === "book" && book !== undefined;
  return {
    ...rest,
    originalPrice: rest.originalPrice ?? null,
    costPrice: rest.costPrice ?? null,
    badge: rest.badge ?? null,
    unit: rest.unit ?? null,
    description: rest.description ?? null,
    nutrition: rest.nutrition ?? null,
    origin: rest.origin ?? null,
    dietary: rest.dietary ?? [],
    bookAuthor: isBook ? book.author : null,
    bookIsbn: isBook ? (book.isbn ?? null) : null,
    bookAvailability: isBook ? book.availability : null,
    bookCopies: isBook ? (book.copies ?? null) : null,
  };
}

/** The persisted columns a Product maps from (DB-only timestamps dropped). */
type ProductRow = {
  id: string;
  kind: string;
  name: string;
  price: number;
  originalPrice: number | null;
  costPrice: number | null;
  rating: number;
  ratingCount: number;
  stockQuantity: number;
  madeToOrder: boolean;
  imageUrl: string;
  categoryId: string;
  isFeatured: boolean;
  isPublished: boolean;
  badge: string | null;
  unit: string | null;
  description: string | null;
  nutrition: string | null;
  origin: string | null;
  dietary: string[];
  taxExempt: boolean;
  bookAuthor: string | null;
  bookIsbn: string | null;
  bookAvailability: string | null;
  bookCopies: number | null;
};

/** Narrow a stored kind; an unknown value reads as a drink rather than failing the whole list. */
function toKind(value: string): ProductKind {
  return (PRODUCT_KINDS as readonly string[]).includes(value) ? (value as ProductKind) : "drink";
}

function toBook(row: ProductRow): BookDetails | undefined {
  if (row.kind !== "book" || row.bookAuthor == null) return undefined;
  const availability: BookAvailability = (BOOK_AVAILABILITIES as readonly string[]).includes(row.bookAvailability ?? "")
    ? (row.bookAvailability as BookAvailability)
    : "sale";
  return {
    author: row.bookAuthor,
    isbn: row.bookIsbn ?? undefined,
    availability,
    ...(row.bookCopies != null ? { copies: row.bookCopies } : {}),
  };
}

/**
 * Map a Prisma row to the domain entity. `discountPercent` is derived (never
 * stored) so it can't drift from the prices; nullable columns collapse to the
 * entity's optional (`undefined`) fields.
 */
function toProduct(row: ProductRow): Product {
  const originalPrice = row.originalPrice ?? undefined;
  return {
    id: row.id,
    kind: toKind(row.kind),
    name: row.name,
    price: row.price,
    originalPrice,
    discountPercent: originalPrice != null ? Math.round((1 - row.price / originalPrice) * 100) : undefined,
    costPrice: row.costPrice ?? undefined,
    rating: row.rating,
    ratingCount: row.ratingCount,
    stockQuantity: row.stockQuantity,
    madeToOrder: row.madeToOrder,
    imageUrl: row.imageUrl,
    categoryId: row.categoryId,
    isFeatured: row.isFeatured,
    isPublished: row.isPublished,
    badge: row.badge ?? undefined,
    unit: row.unit ?? undefined,
    description: row.description ?? undefined,
    nutrition: row.nutrition ?? undefined,
    origin: row.origin ?? undefined,
    dietary: row.dietary,
    taxExempt: row.taxExempt,
    book: toBook(row),
  };
}

/** A management-list row: the item, and for a made-to-order one its recipe's warning. */
function toListItem(row: Prisma.ProductGetPayload<{ include: typeof WITH_RECIPE_STOCK }>): ProductListItem {
  const product = toProduct(row);
  if (!row.madeToOrder) return product;
  const ingredientAlert = ingredientAlertFor(
    row.recipeLines.map(({ ingredient }) => ({
      name: ingredient.name,
      onHand: ingredient.onHand,
      reorderLevel: ingredient.reorderLevel ?? undefined,
    })),
  );
  return ingredientAlert ? { ...product, ingredientAlert } : product;
}

/**
 * Persist an item's per-locale translations to the side table. `undefined` leaves
 * them untouched; a list replaces the set — locales absent from it are deleted (so
 * `[]` clears all), the rest upserted.
 */
async function replaceProductTranslations(
  tx: Prisma.TransactionClient,
  productId: string,
  translations?: ProductTranslationInput[],
): Promise<void> {
  if (translations === undefined) return;

  const locales = translations.map((t) => t.locale);
  const where: Prisma.ProductTranslationWhereInput = { productId };
  if (locales.length > 0) where.locale = { notIn: locales };

  await tx.productTranslation.deleteMany({ where });
  for (const t of translations) {
    const fields = {
      name: t.name,
      unit: t.unit ?? null,
      description: t.description ?? null,
      nutrition: t.nutrition ?? null,
      origin: t.origin ?? null,
    };
    await tx.productTranslation.upsert({
      where: { productId_locale: { productId, locale: t.locale } },
      create: { productId, locale: t.locale, ...fields },
      update: fields,
    });
  }
}

/**
 * Overlay per-locale translations onto canonical items. For the default locale (no
 * `locale` passed) the base rows are returned as-is; otherwise translated fields
 * replace the canonical text, falling back field-by-field to the base row.
 */
async function localizeProducts<T extends Product>(products: T[], locale?: string): Promise<T[]> {
  if (!locale || products.length === 0) return products;

  const translations = await prisma.productTranslation.findMany({
    where: { locale, productId: { in: products.map((p) => p.id) } },
  });
  if (translations.length === 0) return products;

  const byId = new Map(translations.map((t) => [t.productId, t]));
  return products.map((product) => {
    const t = byId.get(product.id);
    if (!t) return product;
    return {
      ...product,
      name: t.name,
      unit: t.unit ?? product.unit,
      description: t.description ?? product.description,
      nutrition: t.nutrition ?? product.nutrition,
      origin: t.origin ?? product.origin,
    };
  });
}

/**
 * Translate Prisma's known request errors into transport-agnostic domain errors
 * so callers never branch on Prisma codes; every other error passes through.
 */
function toDomainError(error: unknown): unknown {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
    // The targeted row no longer exists (lost a race with a delete).
    return new NotFoundError("product", undefined, { cause: error });
  }
  return error;
}
