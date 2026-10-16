import { getLocale, getTranslations } from "next-intl/server";

import { ingredientUnitCost, type Ingredient } from "@/src/domain/entities/Pricing";
import { formatMoney } from "@/src/lib/formatMoney";
import { formatNumber } from "@/src/lib/formatNumber";
import { Badge } from "@/src/presentation/design-system";

import { IngredientDialog } from "./IngredientDialog";
import { PricingTabs } from "./PricingTabs";

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
      {canWrite ? (
        <div>
          <IngredientDialog />
        </div>
      ) : null}

      <section className="min-w-0 overflow-x-auto rounded-card-lg border border-border bg-background">
        {ingredients.length === 0 ? (
          <p className="px-6 py-16 text-center text-body-small-emphasis text-muted-foreground">{t("ingredients.empty")}</p>
        ) : (
          <table className="w-full min-w-[36rem] text-body-small">
            <thead className="bg-surface text-body-caption text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-3 text-start font-medium">{t("ingredients.colName")}</th>
                <th scope="col" className="px-4 py-3 text-end font-medium">{t("ingredients.colBought")}</th>
                <th scope="col" className="px-4 py-3 text-end font-medium">{t("ingredients.colUnitCost")}</th>
                <th scope="col" className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {ingredients.map((ingredient) => (
                <tr key={ingredient.id}>
                  <td className="px-4 py-3">
                    <span className="text-body-small-emphasis text-foreground" dir="auto">
                      {ingredient.name}
                    </span>
                    {!ingredient.isActive ? (
                      <Badge size="sm" variant="neutral" className="ms-2">
                        {t("ingredients.inactive")}
                      </Badge>
                    ) : null}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-end">
                    {t("ingredients.bought", {
                      price: formatMoney(ingredient.purchasePrice, locale),
                      quantity: formatNumber(ingredient.purchaseQuantity, locale, 3),
                      unit: t(`unit.${ingredient.unit}`),
                    })}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-end text-muted-foreground">
                    {t("ingredients.perUnit", { cost: formatNumber(ingredientUnitCost(ingredient), locale, 2), unit: t(`unit.${ingredient.unit}`) })}
                  </td>
                  <td className="px-4 py-3 text-end">{canWrite ? <IngredientDialog ingredient={ingredient} /> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
