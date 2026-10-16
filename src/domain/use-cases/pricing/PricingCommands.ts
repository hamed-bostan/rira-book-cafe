import { isCostOfSales } from "../../entities/AccountingReports";
import { singleChange, type ActivityActor } from "../../entities/ActivityEntry";
import { completeMonthsBefore, jalaliToday } from "../../entities/JalaliCalendar";
import {
  buildPricingReport,
  INGREDIENT_UNITS,
  MAX_MARKUP_BPS,
  MAX_OVERHEAD_MONTHS,
  MAX_RECIPE_LINES,
  type Ingredient,
  type OverheadBasis,
  type PricingReport,
  type PricingSettings,
  type RecipeLine,
} from "../../entities/Pricing";
import { NotFoundError } from "../../errors/NotFoundError";
import { ValidationError } from "../../errors/ValidationError";

import type { ILedgerRepository } from "../../repositories/ILedgerRepository";
import type { IngredientInput, IPricingRepository, RepricedProduct } from "../../repositories/IPricingRepository";

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
    const [movements, sales] = await Promise.all([this.ledger.movements(span.fromDay, span.toDay, { excludeClosing: true }), this.ledger.itemSalesCost(span.fromDay, span.toDay)]);

    const operating = new Set(accounts.filter((account) => account.type === "expense" && !isCostOfSales(account)).map((account) => account.code));
    const recordedOverhead = movements.filter((row) => operating.has(row.accountCode)).reduce((sum, row) => sum + row.debit - row.credit, 0);
    const unitsSold = new Map(sales.map((row) => [row.productId, row.quantity]));
    const totalUnits = sales.reduce((sum, row) => sum + row.quantity, 0);

    const fromLedger = recordedOverhead > 0 ? Math.round(recordedOverhead / settings.overheadMonths) : null;
    const basis: OverheadBasis = {
      source: settings.overheadSource,
      monthlyOverhead: settings.overheadSource === "manual" ? (settings.manualMonthlyOverhead ?? null) : fromLedger,
      monthlyUnits: settings.expectedMonthlyUnits ?? (totalUnits > 0 ? Math.round(totalUnits / settings.overheadMonths) : null),
      fromDay: span.fromDay,
      toDay: span.toDay,
      months: settings.overheadMonths,
    };

    return buildPricingReport({ products, recipes, ingredients, basis, settings, vatRateBps: ledgerSettings.vatRateBps, unitsSold });
  }
}

export class UpdatePricingSettings {
  constructor(private readonly pricing: IPricingRepository) {}

  async execute(settings: PricingSettings): Promise<PricingSettings> {
    if (!Number.isInteger(settings.defaultMarkupBps) || settings.defaultMarkupBps < 0 || settings.defaultMarkupBps > MAX_MARKUP_BPS) {
      throw new ValidationError("defaultMarkup", "Enter a profit from 0 to 1000%.");
    }
    if (!Number.isInteger(settings.overheadMonths) || settings.overheadMonths < 1 || settings.overheadMonths > MAX_OVERHEAD_MONTHS) {
      throw new ValidationError("overheadMonths", "Average over 1 to 12 months.");
    }
    if (settings.overheadSource === "manual" && settings.manualMonthlyOverhead === undefined) {
      throw new ValidationError("manualMonthlyOverhead", "Enter the monthly running costs.");
    }
    return this.pricing.updateSettings(settings);
  }
}

/** Set an item's own profit target, or clear it to use the default. */
export class SetItemMarkup {
  constructor(private readonly pricing: IPricingRepository) {}

  async execute(productId: string, markupBps: number | null): Promise<void> {
    if (markupBps !== null && (!Number.isInteger(markupBps) || markupBps < 0 || markupBps > MAX_MARKUP_BPS)) {
      throw new ValidationError("markup", "Enter a profit from 0 to 1000%.");
    }
    await this.pricing.setTargetMarkup(productId, markupBps);
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

  async execute(productId: string, expectedPrice: number, actor: ActivityActor, now: Date = new Date()): Promise<RepricedProduct> {
    const report = await new GetPricingReport(this.pricing, this.ledger).execute(now);
    const row = report.rows.find((candidate) => candidate.productId === productId);
    if (!row) throw new NotFoundError("product", productId);
    if (row.suggestedPrice === null) throw new ValidationError("price", "This item has no cost yet, so there's no suggestion to apply.");

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

function validIngredient(input: IngredientInput): IngredientInput {
  const name = input.name.trim();
  if (!name) throw new ValidationError("name", "Enter the ingredient's name.");
  if (!(INGREDIENT_UNITS as readonly string[]).includes(input.unit)) throw new ValidationError("unit", "Choose a unit.");
  if (!Number.isSafeInteger(input.purchasePrice) || input.purchasePrice < 0) throw new ValidationError("purchasePrice", "Enter the price paid.");
  if (!(input.purchaseQuantity > 0)) throw new ValidationError("purchaseQuantity", "Enter how much that price buys.");
  return { ...input, name };
}

export class SaveIngredient {
  constructor(private readonly pricing: IPricingRepository) {}

  create(input: IngredientInput): Promise<Ingredient> {
    return this.pricing.createIngredient(validIngredient(input));
  }

  /** Changing the price re-costs every recipe that uses it. */
  update(id: string, input: IngredientInput & { isActive: boolean }): Promise<Ingredient> {
    return this.pricing.updateIngredient(id, { ...validIngredient(input), isActive: input.isActive });
  }
}

/** Replace an item's recipe; its cost price follows. */
export class SaveRecipe {
  constructor(private readonly pricing: IPricingRepository) {}

  async execute(productId: string, lines: RecipeLine[]): Promise<RecipeLine[]> {
    if (lines.length > MAX_RECIPE_LINES) throw new ValidationError("lines", "That recipe has too many lines.");
    const seen = new Set<string>();
    for (const line of lines) {
      if (!(line.quantity > 0)) throw new ValidationError("lines", "Each quantity must be more than zero.");
      if (seen.has(line.ingredientId)) throw new ValidationError("lines", "Each ingredient appears once per recipe.");
      seen.add(line.ingredientId);
    }
    return this.pricing.saveRecipe(productId, lines);
  }
}

