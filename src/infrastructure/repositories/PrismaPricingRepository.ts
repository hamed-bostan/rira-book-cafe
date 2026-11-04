import { MAX_ORDER_AMOUNT } from "@/src/domain/entities/Order";
import {
  DEFAULT_PRICING_SETTINGS,
  INGREDIENT_UNITS,
  ingredientEditRefusal,
  OVERHEAD_SOURCES,
  recipeCost,
  type Ingredient,
  type IngredientEditRefusal,
  type IngredientUnit,
  type OverheadSource,
  type PricedProduct,
  type PricingSettings,
  type RecipeLine,
} from "@/src/domain/entities/Pricing";
import { PRODUCT_KINDS, type ProductKind } from "@/src/domain/entities/Product";
import { ConflictError } from "@/src/domain/errors/ConflictError";
import { NotFoundError } from "@/src/domain/errors/NotFoundError";
import { ValidationError } from "@/src/domain/errors/ValidationError";
import type { AuditHook } from "@/src/domain/repositories/AuditHook";
import type {
  IngredientInput,
  IPricingRepository,
  RepricedProduct,
} from "@/src/domain/repositories/IPricingRepository";
import { prisma } from "@/src/infrastructure/prisma/client";
import { Prisma } from "@/src/infrastructure/prisma/generated/client";

import { recordAudit } from "./writeActivityEntry";
import { lockStock } from "./writeStock";

/** An ingredient read with whether it has any stock history. */
const WITH_HISTORY = { _count: { select: { stockMovements: true } } } satisfies Prisma.IngredientInclude;

type IngredientRow = Prisma.IngredientGetPayload<{ include: typeof WITH_HISTORY }>;

/** What each refused edit says, and the form field it's about. */
const INGREDIENT_REFUSALS: Record<IngredientEditRefusal, { message: string; field: string }> = {
  UNIT_LOCKED: {
    message: "This item holds stock or has stock history, so its unit can't change.",
    field: "unit",
  },
  STOCK_ON_HAND: {
    message: "This item still holds stock. Count it to zero or record it as waste before switching it off.",
    field: "isActive",
  },
  INGREDIENT_IN_RECIPE: {
    message: "A menu item's recipe uses this item. Take it out of those recipes before switching it off.",
    field: "isActive",
  },
};

/**
 * Ingredients, recipes and pricing settings in PostgreSQL. Recipes drive each
 * item's cost price: whenever a recipe or an ingredient's price changes, the cost
 * price of every affected item is recomputed in the same transaction — so the cost
 * orders snapshot (and the books' cost of sales) always follows the recipes.
 */
export class PrismaPricingRepository implements IPricingRepository {
  async listIngredients(includeInactive: boolean): Promise<Ingredient[]> {
    const rows = await prisma.ingredient.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: { name: "asc" },
      include: WITH_HISTORY,
    });
    return rows.map(toIngredient);
  }

  async createIngredient(input: IngredientInput): Promise<Ingredient> {
    return toIngredient(
      await prisma.ingredient.create({
        data: { ...input, purchasePrice: BigInt(input.purchasePrice) },
        include: WITH_HISTORY,
      }),
    );
  }

  async updateIngredient(id: string, input: IngredientInput & { isActive: boolean }): Promise<Ingredient> {
    return prisma.$transaction(async (tx) => {
      // Locked as every stock write locks it, so no delivery or sale can slip in
      // between the checks below and the save.
      if ((await lockStock(tx, [id])).size === 0) throw new NotFoundError("ingredient", id);
      const existing = toIngredient(await tx.ingredient.findUniqueOrThrow({ where: { id }, include: WITH_HISTORY }));
      const switchingOff = existing.isActive && !input.isActive;
      const usedByPublishedItem =
        switchingOff &&
        (await tx.recipeLine.count({ where: { ingredientId: id, product: { isPublished: true } } })) > 0;
      const refusal = ingredientEditRefusal(existing, input, usedByPublishedItem);
      if (refusal) {
        const { message, field } = INGREDIENT_REFUSALS[refusal];
        throw new ConflictError(refusal, message, { fields: [field] });
      }

      const row = await tx.ingredient.update({
        where: { id },
        data: { ...input, purchasePrice: BigInt(input.purchasePrice) },
        include: WITH_HISTORY,
      });
      if (existing.purchasePrice !== Number(row.purchasePrice) || existing.purchaseQuantity !== row.purchaseQuantity) {
        const affected = await tx.recipeLine.findMany({ where: { ingredientId: id }, select: { productId: true } });
        for (const productId of new Set(affected.map((line) => line.productId))) {
          await recostProduct(tx, productId, "purchasePrice");
        }
      }
      return toIngredient(row);
    });
  }

  async listRecipes(): Promise<Map<string, RecipeLine[]>> {
    const rows = await prisma.recipeLine.findMany({ orderBy: [{ productId: "asc" }, { position: "asc" }] });
    const recipes = new Map<string, RecipeLine[]>();
    for (const row of rows) {
      const lines = recipes.get(row.productId) ?? [];
      lines.push({ ingredientId: row.ingredientId, quantity: row.quantity });
      recipes.set(row.productId, lines);
    }
    return recipes;
  }

  async getRecipe(productId: string): Promise<RecipeLine[]> {
    const rows = await prisma.recipeLine.findMany({ where: { productId }, orderBy: { position: "asc" } });
    return rows.map((row) => ({ ingredientId: row.ingredientId, quantity: row.quantity }));
  }

  async saveRecipe(productId: string, lines: RecipeLine[]): Promise<RecipeLine[]> {
    try {
      return await prisma.$transaction(async (tx) => {
        const product = await tx.product.findUnique({ where: { id: productId }, select: { id: true } });
        if (!product) throw new NotFoundError("product", productId);
        await tx.recipeLine.deleteMany({ where: { productId } });
        await tx.recipeLine.createMany({
          data: lines.map((line, position) => ({
            productId,
            ingredientId: line.ingredientId,
            quantity: line.quantity,
            position,
          })),
        });
        await recostProduct(tx, productId, "lines");
        return lines;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
        throw new ValidationError("lines", "One of the ingredients no longer exists.", { cause: error });
      }
      throw error;
    }
  }

  async getSettings(): Promise<PricingSettings> {
    const row = await prisma.pricingSettings.findUnique({ where: { id: 1 } });
    if (!row) return DEFAULT_PRICING_SETTINGS;
    return {
      defaultMarkupBps: row.defaultMarkupBps,
      roundingStep: row.roundingStep,
      overheadSource: toSource(row.overheadSource),
      manualMonthlyOverhead: row.manualMonthlyOverhead === null ? undefined : Number(row.manualMonthlyOverhead),
      expectedMonthlyUnits: row.expectedMonthlyUnits ?? undefined,
      overheadMonths: row.overheadMonths,
    };
  }

  async updateSettings(settings: PricingSettings): Promise<PricingSettings> {
    const data = {
      defaultMarkupBps: settings.defaultMarkupBps,
      roundingStep: settings.roundingStep,
      overheadSource: settings.overheadSource,
      manualMonthlyOverhead:
        settings.manualMonthlyOverhead === undefined ? null : BigInt(settings.manualMonthlyOverhead),
      expectedMonthlyUnits: settings.expectedMonthlyUnits ?? null,
      overheadMonths: settings.overheadMonths,
    };
    await prisma.pricingSettings.upsert({ where: { id: 1 }, create: { id: 1, ...data }, update: data });
    return this.getSettings();
  }

  async listPricedProducts(): Promise<PricedProduct[]> {
    const rows = await prisma.product.findMany({
      orderBy: [{ kind: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        kind: true,
        price: true,
        taxExempt: true,
        costPrice: true,
        targetMarkupBps: true,
      },
    });
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      kind: toKind(row.kind),
      price: row.price,
      taxExempt: row.taxExempt,
      costPrice: row.costPrice ?? undefined,
      targetMarkupBps: row.targetMarkupBps ?? undefined,
    }));
  }

  async setTargetMarkup(productId: string, markupBps: number | null): Promise<void> {
    const result = await prisma.product.updateMany({ where: { id: productId }, data: { targetMarkupBps: markupBps } });
    if (result.count === 0) throw new NotFoundError("product", productId);
  }

  async applyPrice(
    productId: string,
    expectedPrice: number,
    newPrice: number,
    audit?: AuditHook<RepricedProduct>,
  ): Promise<RepricedProduct> {
    return prisma.$transaction(async (tx) => {
      const result = await tx.product.updateMany({
        where: { id: productId, price: expectedPrice },
        data: { price: newPrice },
      });
      const row = await tx.product.findUnique({
        where: { id: productId },
        select: { id: true, name: true, price: true },
      });
      if (!row) throw new NotFoundError("product", productId);
      if (result.count === 0)
        throw new ConflictError("INVALID_TRANSITION", "The price was changed by someone else meanwhile.");
      const repriced = { id: row.id, name: row.name, before: expectedPrice, after: row.price };
      await recordAudit(tx, repriced, audit);
      return repriced;
    });
  }
}

/** Re-cost every item whose recipe uses any of these ingredients (after a price change). */
export async function recostProductsUsing(
  tx: Prisma.TransactionClient,
  ingredientIds: readonly string[],
): Promise<void> {
  const affected = await tx.recipeLine.findMany({
    where: { ingredientId: { in: [...ingredientIds] } },
    select: { productId: true },
  });
  for (const productId of new Set(affected.map((line) => line.productId))) await recostProduct(tx, productId, "lines");
}

/**
 * Set a product's cost price from its recipe; a product without a recipe keeps its
 * manual cost. A cost past what a menu price can be is refused (on `field`, the input
 * that caused it): it's a typo in a price or a quantity, not a real recipe.
 */
async function recostProduct(tx: Prisma.TransactionClient, productId: string, field: string): Promise<void> {
  const lines = await tx.recipeLine.findMany({
    where: { productId },
    include: { ingredient: { include: WITH_HISTORY } },
  });
  if (lines.length === 0) return;
  const cost = recipeCost(
    lines.map((line) => ({ ingredientId: line.ingredientId, quantity: line.quantity })),
    new Map(lines.map((line) => [line.ingredientId, toIngredient(line.ingredient)])),
  );
  if (cost === null) return;
  if (cost > MAX_ORDER_AMOUNT)
    throw new ValidationError(field, "That would make an item cost more than a menu price can be.");
  await tx.product.update({ where: { id: productId }, data: { costPrice: cost } });
}

function toSource(value: string): OverheadSource {
  return (OVERHEAD_SOURCES as readonly string[]).includes(value) ? (value as OverheadSource) : "ledger";
}

function toUnit(value: string): IngredientUnit {
  return (INGREDIENT_UNITS as readonly string[]).includes(value) ? (value as IngredientUnit) : "piece";
}

function toKind(value: string): ProductKind {
  return (PRODUCT_KINDS as readonly string[]).includes(value) ? (value as ProductKind) : "drink";
}

function toIngredient(row: IngredientRow): Ingredient {
  return {
    id: row.id,
    name: row.name,
    unit: toUnit(row.unit),
    purchasePrice: Number(row.purchasePrice),
    purchaseQuantity: row.purchaseQuantity,
    isActive: row.isActive,
    updatedAt: row.updatedAt.toISOString(),
    onHand: row.onHand,
    hasHistory: row._count.stockMovements > 0,
  };
}
