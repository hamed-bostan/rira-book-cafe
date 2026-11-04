import { getLocale, getTranslations } from "next-intl/server";

import type { StockItem, StockLevel } from "@/src/domain/entities/Inventory";
import { formatMoney, moneyUnit } from "@/src/lib/formatMoney";
import { cn } from "@/src/lib/utils";

import { formatStockQuantity, formatUnitCost } from "./stockFormat";
import { StockLevelBadge } from "./StockLevelBadge";
import { StockRowActions } from "./StockRowActions";

type StockRowProps = {
  item: StockItem;
  /** Draws the average cost and value. */
  costsVisible: boolean;
  canManage: boolean;
};

const QUANTITY_TONE: Record<StockLevel, string> = {
  out: "font-semibold text-error-foreground",
  low: "font-semibold text-warning-foreground",
  ok: "font-medium text-foreground",
};

/**
 * Column tracks for the stock list on a wide frame (from a 56rem card) — the item,
 * on hand, reorder level, value (with access to costs) and the "⋯". Shared by the
 * heading row and every item so they line up. The quantities hold a seven-digit
 * count with the longest unit («میلی‌لیتر»), the value a ten-digit figure in Toman.
 */
export const STOCK_COLUMNS = {
  withCosts: "@4xl/stock:grid-cols-[minmax(0,1fr)_9rem_9rem_11rem_2.5rem]",
  withoutCosts: "@4xl/stock:grid-cols-[minmax(0,1fr)_9rem_9rem_2.5rem]",
} as const;

/**
 * One stock item: its name with a badge when it's low or out, its average cost,
 * then what's on hand (coloured by level), the reorder level and the value. A row
 * on a wide frame; on a narrow one the figures wrap under the name, each labelled.
 */
export async function StockRow({ item, costsVisible, canManage }: StockRowProps) {
  const t = await getTranslations("dashInventory");
  const locale = await getLocale();
  const unit = t(`unit.${item.unit}`);
  const amount = (value: number): string => t("quick.quantity", { quantity: formatStockQuantity(value, locale), unit });

  const figure = "flex min-w-0 flex-col text-start @4xl/stock:text-end";
  const inlineLabel = "text-body-small text-muted-foreground sm:text-body-caption @4xl/stock:hidden";

  return (
    <article
      aria-label={item.name}
      className={cn(
        "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-3 px-5 py-3",
        costsVisible ? STOCK_COLUMNS.withCosts : STOCK_COLUMNS.withoutCosts,
      )}
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-body-strong text-foreground sm:text-body-small-strong" dir="auto">
            {item.name}
          </span>
          {item.level !== "ok" ? <StockLevelBadge level={item.level} /> : null}
        </div>
        {costsVisible ? (
          <span className="text-body-small text-muted-foreground tabular-nums sm:text-body-caption">
            {t("averageCostLine", { cost: `${formatUnitCost(item.averageCost, locale)} ${moneyUnit(locale)}`, unit })}
            {/* The last price paid too, when it's moved away from the average: it's
                what recipes are costed at once this runs out. */}
            {item.lastPurchaseCost > 0 && Math.abs(item.lastPurchaseCost - item.averageCost) >= 0.01
              ? ` · ${t("lastPriceLine", { cost: `${formatUnitCost(item.lastPurchaseCost, locale)} ${moneyUnit(locale)}` })}`
              : null}
          </span>
        ) : null}
      </div>

      {/* The figures: their own wrapped line under the name on a narrow frame,
          columns of the row's grid on a wide one. */}
      <div className="order-1 col-span-full flex flex-wrap gap-x-8 gap-y-2 @4xl/stock:contents">
        <div className={figure}>
          <span className={inlineLabel}>{t("col.onHand")}</span>
          <span className={cn("whitespace-nowrap tabular-nums", QUANTITY_TONE[item.level])}>{amount(item.onHand)}</span>
        </div>
        <div className={figure}>
          <span className={inlineLabel}>{t("col.reorder")}</span>
          <span className="whitespace-nowrap text-foreground/80 tabular-nums">
            {item.reorderLevel !== undefined ? amount(item.reorderLevel) : t("reorderNone")}
          </span>
          {item.parLevel !== undefined ? (
            <span className="text-body-small whitespace-nowrap text-muted-foreground tabular-nums sm:text-body-caption">
              {t("parLine", { quantity: amount(item.parLevel) })}
            </span>
          ) : null}
        </div>
        {costsVisible ? (
          <div className={figure}>
            <span className={inlineLabel}>{t("col.value")}</span>
            <span className="font-medium whitespace-nowrap text-foreground tabular-nums">
              {formatMoney(item.value, locale)}
            </span>
          </div>
        ) : null}
      </div>

      <div className="flex justify-end @4xl/stock:order-1">
        <StockRowActions id={item.id} name={item.name} canManage={canManage} />
      </div>
    </article>
  );
}
