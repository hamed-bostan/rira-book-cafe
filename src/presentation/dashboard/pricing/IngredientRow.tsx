import { getLocale, getTranslations } from "next-intl/server";

import { costBasisOf, costingUnitCost, ingredientUnitCost, type Ingredient } from "@/src/domain/entities/Pricing";
import type { Locale } from "@/src/i18n/routing";
import { formatMoney } from "@/src/lib/formatMoney";
import { formatNumberTrimmed } from "@/src/lib/formatNumber";
import { cn } from "@/src/lib/utils";
import { Badge } from "@/src/presentation/design-system/components/Badge/Badge";

import { IngredientDialog } from "./IngredientDialog";

/**
 * The list's columns on a wide frame — the ingredient, what it was bought at, its
 * cost per unit and the edit button — shared with the heading row so the two line up.
 */
export const INGREDIENT_COLUMNS = "@3xl/ingredients:grid-cols-[minmax(0,1fr)_15rem_11rem_2.5rem]";

/** Below this a cost per gram needs its decimals; above it they only add noise. */
const WHOLE_COST_FROM = 100;

function formatUnitCost(cost: number, locale: Locale): string {
  return formatNumberTrimmed(cost, locale, cost < WHOLE_COST_FROM ? 2 : 0);
}

type IngredientRowProps = {
  ingredient: Ingredient;
  canWrite: boolean;
};

/**
 * One ingredient: its name, what it was bought at and what one unit of it costs.
 * A row on a wide frame; on a narrow one the figures wrap under the name, each
 * labelled, and the edit button stays beside it.
 */
export async function IngredientRow({ ingredient, canWrite }: IngredientRowProps) {
  const t = await getTranslations("dashPricing");
  const locale = await getLocale();

  const unit = t(`unit.${ingredient.unit}`);
  const figure = "flex min-w-0 flex-col gap-0.5";
  const inlineLabel = "text-body-small text-muted-foreground sm:text-body-caption @3xl/ingredients:hidden";

  return (
    <article
      aria-label={ingredient.name}
      className={cn("grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-3 px-5 py-3", INGREDIENT_COLUMNS)}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        <span
          dir="auto"
          className={cn(
            "text-body-strong [overflow-wrap:anywhere] sm:text-body-small-strong",
            ingredient.isActive ? "text-foreground" : "text-muted-foreground",
          )}
        >
          {ingredient.name}
        </span>
        {!ingredient.isActive ? (
          <Badge variant="neutral" appearance="outline" size="compact">
            {t("ingredients.inactive")}
          </Badge>
        ) : null}
      </div>

      {/* The figures: their own wrapped line under the name on a narrow frame,
          columns of the row's grid on a wide one. */}
      <div className="order-1 col-span-full flex flex-wrap gap-x-8 gap-y-2 text-body-default sm:text-body-small @3xl/ingredients:contents">
        <div className={cn(figure, "@3xl/ingredients:items-end @3xl/ingredients:text-end")}>
          <span className={inlineLabel}>{t("ingredients.colBought")}</span>
          {/* Wraps between its words on a phone, so a long price and unit still fit. */}
          <span className="text-foreground/80 tabular-nums @3xl/ingredients:whitespace-nowrap">
            {t("ingredients.bought", {
              price: formatMoney(ingredient.purchasePrice, locale),
              quantity: formatNumberTrimmed(ingredient.purchaseQuantity, locale, 3),
              unit,
            })}
          </span>
        </div>
        <div className={cn(figure, "@3xl/ingredients:items-end @3xl/ingredients:text-end")}>
          <span className={inlineLabel}>{t("ingredients.colUnitCost")}</span>
          <span className="font-semibold whitespace-nowrap text-foreground tabular-nums">
            {t("ingredients.perUnit", { cost: formatUnitCost(costingUnitCost(ingredient), locale), unit })}
          </span>
          {/* Recipes are costed at the average cost of what's on hand (what cost of
              sales books), and at the last price once it's run out: say which, and
              show the other figure when they differ. */}
          <span className="text-body-small whitespace-nowrap text-muted-foreground tabular-nums sm:text-body-caption">
            {costBasisOf(ingredient) === "average"
              ? Math.abs(ingredientUnitCost(ingredient) - ingredient.averageCost) >= 0.01
                ? t("ingredients.averageWithLast", {
                    cost: formatUnitCost(ingredientUnitCost(ingredient), locale),
                    unit,
                  })
                : t("ingredients.basisAverage")
              : t("ingredients.basisLastPrice")}
          </span>
        </div>
      </div>

      <div className="flex justify-end @3xl/ingredients:order-1">
        {canWrite ? <IngredientDialog ingredient={ingredient} /> : null}
      </div>
    </article>
  );
}
