import type { AuditHook } from "./AuditHook";
import type { Ingredient, PricedProduct, PricingSettings, PurchaseUnit, RecipeLine } from "../entities/Pricing";

/**
 * A stock item as it's made. Pricing sets what it was bought at; Inventory sets how
 * it's kept and bought (levels, packs, the usual supplier) — both through here.
 */
export type IngredientInput = Pick<Ingredient, "name" | "unit" | "purchasePrice" | "purchaseQuantity"> & {
  reorderLevel?: number;
  parLevel?: number;
  purchaseUnits?: PurchaseUnit[];
  supplierId?: string;
};

/**
 * A change to a stock item: only the fields given move, so Pricing's price edit and
 * Inventory's level edit never overwrite each other. `null` clears an optional field.
 */
export type IngredientPatch = Partial<Pick<Ingredient, "name" | "unit" | "purchasePrice" | "purchaseQuantity">> & {
  isActive?: boolean;
  reorderLevel?: number | null;
  parLevel?: number | null;
  purchaseUnits?: PurchaseUnit[];
  supplierId?: string | null;
};

/** A stock item before and after an edit, for the audit entry. */
export type IngredientEdit = { before: Ingredient; after: Ingredient };

/** An item's recipe before and after it was replaced, for the audit entry. */
export type RecipeEdit = { productId: string; productName: string; before: RecipeLine[]; after: RecipeLine[] };

/** A product whose price just changed, for the audit entry. */
export type RepricedProduct = { id: string; name: string; before: number; after: number };

export type IPricingRepository = {
  listIngredients(includeInactive: boolean): Promise<Ingredient[]>;
  /**
   * Add an ingredient, or change one. A price change re-costs every item whose
   * recipe uses it (their cost price, which orders snapshot), in the same transaction.
   * Refuses (`NotFoundError`) a supplier that doesn't exist.
   */
  createIngredient(input: IngredientInput, audit?: AuditHook<Ingredient>): Promise<Ingredient>;
  /**
   * Refuses (a `ConflictError` naming the field) what `ingredientEditRefusal`
   * refuses, checked under the stock row's lock: a new unit once the item holds
   * stock or has moved, and switching off an item that holds stock or that a
   * published item's recipe uses. A level that leaves par below the reorder level
   * is refused (`ValidationError` on `parLevel`).
   */
  updateIngredient(id: string, patch: IngredientPatch, audit?: AuditHook<IngredientEdit>): Promise<Ingredient>;

  /** Every recipe, by product id. */
  listRecipes(): Promise<Map<string, RecipeLine[]>>;
  getRecipe(productId: string): Promise<RecipeLine[]>;
  /**
   * Replace an item's recipe and set its cost price to the recipe's cost (an empty
   * recipe leaves the manual cost price alone), in one transaction.
   */
  saveRecipe(productId: string, lines: RecipeLine[], audit?: AuditHook<RecipeEdit>): Promise<RecipeLine[]>;

  getSettings(): Promise<PricingSettings>;
  updateSettings(
    settings: PricingSettings,
    audit?: AuditHook<{ before: PricingSettings; after: PricingSettings }>,
  ): Promise<PricingSettings>;

  /** Every menu item with what pricing needs. */
  listPricedProducts(): Promise<PricedProduct[]>;
  /** Set (or clear, with `null`) an item's own profit target. */
  setTargetMarkup(
    productId: string,
    markupBps: number | null,
    audit?: AuditHook<{ id: string; name: string; before: number | null; after: number | null }>,
  ): Promise<void>;
  /**
   * Change an item's menu price, guarded on the price the owner saw so a concurrent
   * edit isn't overwritten (`ConflictError("INVALID_TRANSITION")`), with its audit entry.
   */
  applyPrice(
    productId: string,
    expectedPrice: number,
    newPrice: number,
    audit?: AuditHook<RepricedProduct>,
  ): Promise<RepricedProduct>;
};
