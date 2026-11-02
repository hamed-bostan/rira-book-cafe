import { getTranslations } from "next-intl/server";

import type { Ingredient } from "@/src/domain/entities/Pricing";
import { cn } from "@/src/lib/utils";

import { DashboardEmptyState } from "../DashboardEmptyState";

import { IngredientDialog } from "./IngredientDialog";
import { INGREDIENT_COLUMNS, IngredientRow } from "./IngredientRow";
import { PricingTabs } from "./PricingTabs";

/**
 * What menu items are made from, priced as bought. Updating a purchase price
 * re-costs every recipe that uses the ingredient.
 */
export async function IngredientsScreen({ ingredients, canWrite }: { ingredients: Ingredient[]; canWrite: boolean }) {
  const t = await getTranslations("dashPricing");

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <PricingTabs active="ingredients" title={t("ingredients.heading")} subtitle={t("ingredients.subtitle")} />

      <section className="@container/ingredients min-w-0 overflow-hidden rounded-card-lg border border-border bg-background shadow-xs">
        {canWrite ? (
          <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2 border-b border-border px-5 py-4">
            <IngredientDialog />
          </div>
        ) : null}

        {ingredients.length === 0 ? (
          <DashboardEmptyState title={t("ingredients.empty")} />
        ) : (
          <>
            <div
              aria-hidden
              className={cn(
                "hidden h-10 items-center gap-x-4 border-b border-border bg-muted px-5 text-body-caption font-semibold tracking-wider whitespace-nowrap text-muted-foreground uppercase @3xl/ingredients:grid",
                INGREDIENT_COLUMNS,
              )}
            >
              <span>{t("ingredients.colName")}</span>
              <span className="text-end">{t("ingredients.colBought")}</span>
              <span className="text-end">{t("ingredients.colUnitCost")}</span>
              <span />
            </div>
            <ul>
              {ingredients.map((ingredient, index) => (
                <li key={ingredient.id} className={cn(index > 0 && "border-t border-border")}>
                  <IngredientRow ingredient={ingredient} canWrite={canWrite} />
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
