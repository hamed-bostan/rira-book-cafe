import { isCostOfSales } from "../../entities/AccountingReports";
import { diffFields, singleChange, type ActivityActor } from "../../entities/ActivityEntry";
import { completeMonthsBefore, jalaliToday } from "../../entities/JalaliCalendar";
import { MAX_ORDER_AMOUNT } from "../../entities/Order";
import {
  buildPricingReport,
  INGREDIENT_UNITS,
  MAX_MARKUP_BPS,
  MAX_MONTHLY_UNITS,
  MAX_OVERHEAD_MONTHS,
  MAX_RECIPE_LINES,
  purchaseUnitsRefusal,
  type Ingredient,
  type IngredientUnit,
  type OverheadBasis,
  type PricingReport,
  type PricingSettings,
  type PurchaseUnit,
  type PurchaseUnitsRefusal,
  type RecipeLine,
} from "../../entities/Pricing";
import { NotFoundError } from "../../errors/NotFoundError";
import { ValidationError } from "../../errors/ValidationError";

import type { ILedgerRepository } from "../../repositories/ILedgerRepository";
import type {
  IngredientInput,
  IngredientPatch,
  IPricingRepository,
  RepricedProduct,
} from "../../repositories/IPricingRepository";

/**
 * The pricing advisor: each item's ingredient cost, its share of the cafe's monthly
 * running costs, and the menu price that adds the owner's profit on top.
 *
 * Overhead is read from the books — operating expenses (rent, salaries, utilities,
 * …; not cost of sales) over the last complete Persian months — unless the owner
 * enters a planned monthly figure. Units sold come from completed sales over the
 * same months, unless an expected monthly figure is set.
 */
export class GetPricingReport {
  constructor(
    private readonly pricing: IPricingRepository,
    private readonly ledger: ILedgerRepository,
  ) {}

  async execute(now: Date = new Date()): Promise<PricingReport> {
    const [settings, ledgerSettings, products, recipes, ingredients, accounts] = await Promise.all([
      this.pricing.getSettings(),
      this.ledger.getSettings(),
      this.pricing.listPricedProducts(),
      this.pricing.listRecipes(),
      this.pricing.listIngredients(true),
      this.ledger.listAccounts(),
    ]);

    const span = completeMonthsBefore(jalaliToday(now), settings.overheadMonths);
    const [movements, sales] = await Promise.all([
      this.ledger.movements(span.fromDay, span.toDay, { excludeClosing: true }),
      this.ledger.itemSalesCost(span.fromDay, span.toDay),
    ]);

    const operating = new Set(
      accounts
        .filter((account) => account.type === "expense" && !isCostOfSales(account))
        .map((account) => account.code),
    );
    const recordedOverhead = movements
      .filter((row) => operating.has(row.accountCode))
      .reduce((sum, row) => sum + row.debit - row.credit, 0);
    const unitsSold = new Map(sales.map((row) => [row.productId, row.quantity]));
    const totalUnits = sales.reduce((sum, row) => sum + row.quantity, 0);

    const fromLedger = recordedOverhead > 0 ? Math.round(recordedOverhead / settings.overheadMonths) : null;
    const basis: OverheadBasis = {
      source: settings.overheadSource,
      monthlyOverhead: settings.overheadSource === "manual" ? (settings.manualMonthlyOverhead ?? null) : fromLedger,
      monthlyUnits:
        settings.expectedMonthlyUnits ?? (totalUnits > 0 ? Math.round(totalUnits / settings.overheadMonths) : null),
      fromDay: span.fromDay,
      toDay: span.toDay,
      months: settings.overheadMonths,
    };

    return buildPricingReport({
      products,
      recipes,
      ingredients,
      basis,
      settings,
      vatRateBps: ledgerSettings.vatRateBps,
      unitsSold,
    });
  }
}

export class UpdatePricingSettings {
  constructor(private readonly pricing: IPricingRepository) {}

  async execute(settings: PricingSettings, actor: ActivityActor): Promise<PricingSettings> {
    if (
      !Number.isInteger(settings.defaultMarkupBps) ||
      settings.defaultMarkupBps < 0 ||
      settings.defaultMarkupBps > MAX_MARKUP_BPS
    ) {
      throw new ValidationError("defaultMarkup", "Enter a profit from 0 to 1000%.");
    }
    if (
      !Number.isInteger(settings.overheadMonths) ||
      settings.overheadMonths < 1 ||
      settings.overheadMonths > MAX_OVERHEAD_MONTHS
    ) {
      throw new ValidationError("overheadMonths", "Average over 1 to 12 months.");
    }
    if (settings.overheadSource === "manual" && settings.manualMonthlyOverhead === undefined) {
      throw new ValidationError("manualMonthlyOverhead", "Enter the monthly running costs.");
    }
    if (
      settings.manualMonthlyOverhead !== undefined &&
      (!Number.isSafeInteger(settings.manualMonthlyOverhead) || settings.manualMonthlyOverhead < 0)
    ) {
      throw new ValidationError("manualMonthlyOverhead", "Enter the monthly running costs.");
    }
    if (
      settings.expectedMonthlyUnits !== undefined &&
      (!Number.isInteger(settings.expectedMonthlyUnits) ||
        settings.expectedMonthlyUnits < 1 ||
        settings.expectedMonthlyUnits > MAX_MONTHLY_UNITS)
    ) {
      throw new ValidationError("expectedMonthlyUnits", "Enter how many items sell a month.");
    }
    return this.pricing.updateSettings(settings, ({ before, after }) => {
      const changes = diffFields(before, after);
      return changes.length === 0
        ? null
        : {
            actorId: actor.id,
            actorName: actor.name,
            action: "pricing.settingsChanged",
            entityType: "pricing",
            entityId: "settings",
            changes,
          };
    });
  }
}

/** Set an item's own profit target, or clear it to use the default. */
export class SetItemMarkup {
  constructor(private readonly pricing: IPricingRepository) {}

  async execute(productId: string, markupBps: number | null, actor: ActivityActor): Promise<void> {
    if (markupBps !== null && (!Number.isInteger(markupBps) || markupBps < 0 || markupBps > MAX_MARKUP_BPS)) {
      throw new ValidationError("markup", "Enter a profit from 0 to 1000%.");
    }
    await this.pricing.setTargetMarkup(productId, markupBps, (item) =>
      item.before === item.after
        ? null
        : {
            actorId: actor.id,
            actorName: actor.name,
            action: "product.updated",
            entityType: "product",
            entityId: item.id,
            entityLabel: item.name,
            changes: singleChange("targetMarkupBps", item.before, item.after),
          },
    );
  }
}

/**
 * Set an item's menu price to the advisor's suggestion. The suggestion is worked
 * out again here — the client only says which item and the price it saw — and the
 * change is audited like any other price edit.
 */
export class ApplySuggestedPrice {
  constructor(
    private readonly pricing: IPricingRepository,
    private readonly ledger: ILedgerRepository,
  ) {}

  async execute(
    productId: string,
    expectedPrice: number,
    actor: ActivityActor,
    now: Date = new Date(),
  ): Promise<RepricedProduct> {
    const report = await new GetPricingReport(this.pricing, this.ledger).execute(now);
    const row = report.rows.find((candidate) => candidate.productId === productId);
    if (!row) throw new NotFoundError("product", productId);
    if (row.suggestedPrice === null)
      throw new ValidationError("price", "This item has no cost yet, so there's no suggestion to apply.");
    if (row.suggestedPrice > MAX_ORDER_AMOUNT)
      throw new ValidationError("price", "The suggestion is more than a menu price can be — check its costs.");

    return this.pricing.applyPrice(productId, expectedPrice, row.suggestedPrice, (repriced) => ({
      actorId: actor.id,
      actorName: actor.name,
      action: "product.updated",
      entityType: "product",
      entityId: repriced.id,
      entityLabel: repriced.name,
      changes: singleChange("price", repriced.before, repriced.after),
    }));
  }
}

function validName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) throw new ValidationError("name", "Enter the ingredient's name.");
  return trimmed;
}

function validUnit(unit: string): void {
  if (!(INGREDIENT_UNITS as readonly string[]).includes(unit)) throw new ValidationError("unit", "Choose a unit.");
}

function validLevel(field: "reorderLevel" | "parLevel", level: number | null | undefined): void {
  if (level !== undefined && level !== null && !(level >= 0))
    throw new ValidationError(field, "Enter a level of zero or more.");
}

/** Par below the reorder level would suggest ordering nothing for an item flagged as running low. */
function validLevels(reorderLevel: number | null | undefined, parLevel: number | null | undefined): void {
  validLevel("reorderLevel", reorderLevel);
  validLevel("parLevel", parLevel);
  if (typeof reorderLevel === "number" && typeof parLevel === "number" && parLevel < reorderLevel)
    throw new ValidationError("parLevel", "parBelowReorder");
}

/** The message key each refusal is shown as (formErrors). */
const PURCHASE_UNIT_REFUSALS: Record<PurchaseUnitsRefusal, string> = {
  TOO_MANY: "purchaseUnitsTooMany",
  NAME_INVALID: "purchaseUnitNameInvalid",
  FACTOR_INVALID: "purchaseUnitFactorInvalid",
  NAME_REPEATED: "purchaseUnitRepeated",
};

function validPurchaseUnits(units: readonly PurchaseUnit[], unit: IngredientUnit): PurchaseUnit[] {
  const trimmed = units.map((entry) => ({ name: entry.name.trim(), factor: entry.factor }));
  const refusal = purchaseUnitsRefusal(trimmed, unit);
  if (refusal) throw new ValidationError("purchaseUnits", PURCHASE_UNIT_REFUSALS[refusal]);
  return trimmed;
}

function validIngredient(input: IngredientInput): IngredientInput {
  const name = validName(input.name);
  validUnit(input.unit);
  if (!Number.isSafeInteger(input.purchasePrice) || input.purchasePrice < 0)
    throw new ValidationError("purchasePrice", "Enter the price paid.");
  if (!(input.purchaseQuantity > 0)) throw new ValidationError("purchaseQuantity", "Enter how much that price buys.");
  validLevels(input.reorderLevel, input.parLevel);
  return {
    ...input,
    name,
    purchaseUnits: input.purchaseUnits ? validPurchaseUnits(input.purchaseUnits, input.unit) : undefined,
  };
}

function validPatch(patch: IngredientPatch): IngredientPatch {
  const next: IngredientPatch = { ...patch };
  if (patch.name !== undefined) next.name = validName(patch.name);
  if (patch.unit !== undefined) validUnit(patch.unit);
  if (patch.purchasePrice !== undefined && (!Number.isSafeInteger(patch.purchasePrice) || patch.purchasePrice < 0))
    throw new ValidationError("purchasePrice", "Enter the price paid.");
  if (patch.purchaseQuantity !== undefined && !(patch.purchaseQuantity > 0))
    throw new ValidationError("purchaseQuantity", "Enter how much that price buys.");
  validLevels(patch.reorderLevel, patch.parLevel);
  if (patch.purchaseUnits !== undefined) {
    // Packs are counted in the base unit, so they're saved with it.
    if (patch.unit === undefined) throw new ValidationError("unit", "Choose a unit.");
    next.purchaseUnits = validPurchaseUnits(patch.purchaseUnits, patch.unit);
  }
  return next;
}

/** A stock item's fields as the activity log diffs them. Purchase units read "bag = 1000, carton = 12". */
function ingredientSnapshot(item: Ingredient): Record<string, unknown> {
  return {
    name: item.name,
    unit: item.unit,
    purchasePrice: item.purchasePrice,
    purchaseQuantity: item.purchaseQuantity,
    isActive: item.isActive,
    reorderLevel: item.reorderLevel,
    parLevel: item.parLevel,
    purchaseUnits: item.purchaseUnits.map((unit) => `${unit.name} = ${unit.factor}`).join(", "),
    supplierId: item.supplierId,
  };
}

/**
 * Add or change a stock item. One use-case behind both screens that make them:
 * Pricing (what it was bought at, `accounting.write`) and Inventory (its levels,
 * packs and usual supplier, `inventory.manage`). Each sends only its own fields
 * (see `IngredientPatch`), and every save is in the activity log.
 */
export class SaveIngredient {
  constructor(private readonly pricing: IPricingRepository) {}

  create(input: IngredientInput, actor: ActivityActor): Promise<Ingredient> {
    return this.pricing.createIngredient(validIngredient(input), (created) => ({
      actorId: actor.id,
      actorName: actor.name,
      action: "stockItem.created",
      entityType: "stockItem",
      entityId: created.id,
      entityLabel: created.name,
      changes: diffFields({}, ingredientSnapshot(created)),
    }));
  }

  /** Changing the price re-costs every recipe that uses it. */
  update(id: string, patch: IngredientPatch, actor: ActivityActor): Promise<Ingredient> {
    return this.pricing.updateIngredient(id, validPatch(patch), ({ before, after }) => {
      const changes = diffFields(ingredientSnapshot(before), ingredientSnapshot(after));
      return changes.length === 0
        ? null
        : {
            actorId: actor.id,
            actorName: actor.name,
            action: "stockItem.updated",
            entityType: "stockItem",
            entityId: after.id,
            entityLabel: after.name,
            changes,
          };
    });
  }
}

/** A recipe as one line of the activity log: "ingredient-id × 18, …". */
function recipeText(lines: readonly RecipeLine[]): string {
  return lines.map((line) => `${line.ingredientId} × ${line.quantity}`).join(", ");
}

/** Replace an item's recipe; its cost price follows. */
export class SaveRecipe {
  constructor(private readonly pricing: IPricingRepository) {}

  async execute(productId: string, lines: RecipeLine[], actor: ActivityActor): Promise<RecipeLine[]> {
    if (lines.length > MAX_RECIPE_LINES) throw new ValidationError("lines", "That recipe has too many lines.");
    const seen = new Set<string>();
    for (const line of lines) {
      if (!(line.quantity > 0)) throw new ValidationError("lines", "Each quantity must be more than zero.");
      if (seen.has(line.ingredientId)) throw new ValidationError("lines", "Each ingredient appears once per recipe.");
      seen.add(line.ingredientId);
    }
    return this.pricing.saveRecipe(productId, lines, (edit) => {
      const changes = diffFields(
        { recipe: recipeText(edit.before), recipeLines: edit.before.length },
        { recipe: recipeText(edit.after), recipeLines: edit.after.length },
      );
      return changes.length === 0
        ? null
        : {
            actorId: actor.id,
            actorName: actor.name,
            action: "product.recipeChanged",
            entityType: "product",
            entityId: edit.productId,
            entityLabel: edit.productName,
            changes,
          };
    });
  }
}
