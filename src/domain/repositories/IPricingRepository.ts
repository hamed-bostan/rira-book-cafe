import type { AuditHook } from "./AuditHook";
import type { Ingredient, PricedProduct, PricingSettings, RecipeLine } from "../entities/Pricing";

export type IngredientInput = Pick<Ingredient, "name" | "unit" | "purchasePrice" | "purchaseQuantity">;

/** A product whose price just changed, for the audit entry. */
export type RepricedProduct = { id: string; name: string; before: number; after: number };

export type IPricingRepository = {
  listIngredients(includeInactive: boolean): Promise<Ingredient[]>;
  /**
   * Add an ingredient, or change one. A price change re-costs every item whose
   * recipe uses it (their cost price, which orders snapshot), in the same transaction.
   */
  createIngredient(input: IngredientInput): Promise<Ingredient>;
  updateIngredient(id: string, input: IngredientInput & { isActive: boolean }): Promise<Ingredient>;

  /** Every recipe, by product id. */
  listRecipes(): Promise<Map<string, RecipeLine[]>>;
  getRecipe(productId: string): Promise<RecipeLine[]>;
  /**
   * Replace an item's recipe and set its cost price to the recipe's cost (an empty
   * recipe leaves the manual cost price alone), in one transaction.
   */
  saveRecipe(productId: string, lines: RecipeLine[]): Promise<RecipeLine[]>;

  getSettings(): Promise<PricingSettings>;
  updateSettings(settings: PricingSettings): Promise<PricingSettings>;

  /** Every menu item with what pricing needs. */
  listPricedProducts(): Promise<PricedProduct[]>;
  /** Set (or clear, with `null`) an item's own profit target. */
  setTargetMarkup(productId: string, markupBps: number | null): Promise<void>;
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
