import { getLocale, getTranslations } from "next-intl/server";

import { ingredientUnitCost, type Ingredient } from "@/src/domain/entities/Pricing";
import type { Locale } from "@/src/i18n/routing";
import { formatMoney } from "@/src/lib/formatMoney";
import { formatNumberTrimmed } from "@/src/lib/formatNumber";
import { cn } from "@/src/lib/utils";
import { Badge } from "@/src/presentation/design-system/components/Badge/Badge";

import { DashboardEmptyState } from "../DashboardEmptyState";
import { OVERLINE } from "../fieldStyles";

import { IngredientDialog } from "./IngredientDialog";
import { PricingTabs } from "./PricingTabs";

/** A column's title; the first and last cells carry the card's 20px inset. */
const HEAD = cn(OVERLINE, "px-2 py-2 first:ps-5 last:pe-5");
const CELL = "px-2 py-3 first:ps-5 last:pe-5";

/** Below this a cost per gram needs its decimals; above it they only add noise. */
const WHOLE_COST_FROM = 100;

function formatUnitCost(cost: number, locale: Locale): string {
  return formatNumberTrimmed(cost, locale, cost < WHOLE_COST_FROM ? 2 : 0);
}

/**
 * What menu items are made from, priced as bought. Updating a purchase price
 * re-costs every recipe that uses the ingredient.
 */
export async function IngredientsScreen({ ingredients, canWrite }: { ingredients: Ingredient[]; canWrite: boolean }) {
  const t = await getTranslations("dashPricing");
  const locale = await getLocale();

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <PricingTabs active="ingredients" title={t("ingredients.heading")} subtitle={t("ingredients.subtitle")} />

      <section className="min-w-0 overflow-hidden rounded-card-lg border border-border bg-background shadow-xs">
        {canWrite ? (
          <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2 border-b border-border px-5 py-4">
            <IngredientDialog />
          </div>
        ) : null}

        {ingredients.length === 0 ? (
          <DashboardEmptyState title={t("ingredients.empty")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[39rem] table-fixed text-body-default sm:text-body-small">
              <colgroup>
                <col />
                <col className="w-60" />
                <col className="w-44" />
                <col className="w-[4.5rem] sm:w-[3.75rem]" />
              </colgroup>
              <thead className="border-b border-border bg-muted">
                <tr>
                  <th scope="col" className={cn(HEAD, "text-start")}>
                    {t("ingredients.colName")}
                  </th>
                  <th scope="col" className={cn(HEAD, "text-end")}>
                    {t("ingredients.colBought")}
                  </th>
                  <th scope="col" className={cn(HEAD, "text-end")}>
                    {t("ingredients.colUnitCost")}
                  </th>
                  <th scope="col" className={HEAD} />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {ingredients.map((ingredient) => (
                  <tr key={ingredient.id}>
                    <td className={CELL}>
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={cn(
                            "font-medium",
                            ingredient.isActive ? "text-foreground" : "text-muted-foreground",
                          )}
                          dir="auto"
                        >
                          {ingredient.name}
                        </span>
                        {!ingredient.isActive ? (
                          <Badge variant="neutral" appearance="outline" size="compact">
                            {t("ingredients.inactive")}
                          </Badge>
                        ) : null}
                      </div>
                    </td>
                    <td className={cn(CELL, "text-end whitespace-nowrap text-foreground/80 tabular-nums")}>
                      {t("ingredients.bought", {
                        price: formatMoney(ingredient.purchasePrice, locale),
                        quantity: formatNumberTrimmed(ingredient.purchaseQuantity, locale, 3),
                        unit: t(`unit.${ingredient.unit}`),
                      })}
                    </td>
                    <td className={cn(CELL, "text-end font-semibold whitespace-nowrap text-foreground tabular-nums")}>
                      {t("ingredients.perUnit", {
                        cost: formatUnitCost(ingredientUnitCost(ingredient), locale),
                        unit: t(`unit.${ingredient.unit}`),
                      })}
                    </td>
                    <td className={CELL}>{canWrite ? <IngredientDialog ingredient={ingredient} /> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
