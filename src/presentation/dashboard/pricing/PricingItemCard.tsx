import { getLocale, getTranslations } from "next-intl/server";

import type { PricingRow } from "@/src/domain/entities/Pricing";
import { Link } from "@/src/i18n/navigation";
import { formatPercent } from "@/src/lib/formatCafeDay";
import { formatMoney } from "@/src/lib/formatMoney";
import { formatNumberTrimmed } from "@/src/lib/formatNumber";
import { cn } from "@/src/lib/utils";
import { Badge } from "@/src/presentation/design-system/components/Badge/Badge";

import { FIELD_HINT } from "../fieldStyles";

import { ApplyPriceButton } from "./ApplyPriceButton";
import { ItemMarkupField } from "./ItemMarkupField";

/**
 * The cards, as many abreast as fit at 288px or more each — one on a phone, two
 * on a tablet, three beside the sidebar. Shared with the loading skeleton.
 */
export const PRICING_CARD_GRID = "grid grid-cols-[repeat(auto-fill,minmax(min(18rem,100%),1fr))] gap-3";

/** One group of figures, ruled off from the one above. */
const SECTION = "flex flex-col gap-2 border-t border-border px-5 py-3 text-body-default sm:text-body-small";
/** A label and its figure: side by side where both fit, the figure under its label where they don't. */
const LINE = "flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5";
const LABEL = "text-muted-foreground";
/** A figure and whatever sits under it — the recipe link, the Apply button — kept to the end. */
const VALUE = "ms-auto flex flex-col items-end gap-0.5 text-end";
const FIGURE = "whitespace-nowrap text-foreground tabular-nums";

type PricingItemCardProps = {
  row: PricingRow;
  /** The cafe-wide profit target in basis points, shown when the item has none of its own. */
  defaultMarkupBps: number;
  canWrite: boolean;
  /** Applying a price changes the menu, so it also needs `catalog.write`. */
  canApply: boolean;
};

/**
 * One menu item's pricing, read top to bottom like the formula: what one costs —
 * ingredients plus its share of the running costs — then the profit asked for and
 * the price that earns it, against today's price and what that earns.
 */
export async function PricingItemCard({ row, defaultMarkupBps, canWrite, canApply }: PricingItemCardProps) {
  const t = await getTranslations("dashPricing");
  const locale = await getLocale();
  const losing = row.profitPerUnit !== null && row.profitPerUnit < 0;

  return (
    <article
      aria-labelledby={`pricing-item-${row.productId}`}
      className="flex h-full min-w-0 flex-col rounded-card-lg border border-border bg-background shadow-xs"
    >
      <header className="flex flex-col gap-0.5 px-5 pt-4 pb-3">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h2
            id={`pricing-item-${row.productId}`}
            dir="auto"
            className="text-body-strong [overflow-wrap:anywhere] text-foreground sm:text-body-small-strong"
          >
            {row.name}
          </h2>
          {row.taxExempt ? (
            <Badge variant="neutral" appearance="outline" size="compact">
              {t("vatExempt")}
            </Badge>
          ) : null}
        </div>
        <p className={FIELD_HINT}>
          {t(`kind.${row.kind}`)} · {t("perMonth", { count: formatNumberTrimmed(row.monthlyUnits, locale, 1) })}
        </p>
      </header>

      {/* What one costs: grows to fill the card, so every card's price sits at its foot. */}
      <dl className={cn(SECTION, "flex-1")}>
        <div className={LINE}>
          <dt className={LABEL}>{t("col.ingredients")}</dt>
          <dd className={VALUE}>
            <span className={FIGURE}>{row.directCost === null ? "—" : formatMoney(row.directCost, locale)}</span>
            <Link
              href={`/dashboard/pricing/recipes/${row.productId}`}
              className="-my-3 py-3 text-body-small font-medium whitespace-nowrap text-primary transition-colors hover:text-primary-hover hover:underline sm:my-0 sm:py-0 sm:text-body-caption"
            >
              {t(`costSource.${row.costSource}`)}
            </Link>
          </dd>
        </div>
        <div className={LINE}>
          <dt className={LABEL}>{t("col.overhead")}</dt>
          <dd className={cn(VALUE, FIGURE)}>{formatMoney(row.overheadPerUnit, locale)}</dd>
        </div>
        <div className={LINE}>
          <dt className={cn(LABEL, "font-medium text-foreground")}>{t("col.fullCost")}</dt>
          <dd className={cn(VALUE, FIGURE, "font-medium")}>
            {row.fullCost === null ? "—" : formatMoney(row.fullCost, locale)}
          </dd>
        </div>
      </dl>

      {/* What to charge, and how today's price compares. */}
      <dl className={SECTION}>
        <div className={LINE}>
          <dt className={LABEL}>{t("col.profit")}</dt>
          <dd className={VALUE}>
            {canWrite ? (
              <ItemMarkupField
                productId={row.productId}
                markupBps={row.markupIsDefault ? null : row.markupBps}
                defaultBps={defaultMarkupBps}
              />
            ) : (
              <span className={FIGURE}>{formatNumberTrimmed(row.markupBps / 100, locale, 1)}%</span>
            )}
          </dd>
        </div>
        <div className={LINE}>
          <dt className={cn(LABEL, "font-medium text-foreground")}>{t("col.suggested")}</dt>
          <dd className={VALUE}>
            <span className={cn(FIGURE, "font-semibold")}>
              {row.suggestedPrice === null ? "—" : formatMoney(row.suggestedPrice, locale)}
            </span>
            {canApply && row.suggestedPrice !== null && row.suggestedPrice !== row.price ? (
              <ApplyPriceButton
                productId={row.productId}
                name={row.name}
                currentPrice={row.price}
                suggestedPrice={row.suggestedPrice}
              />
            ) : null}
          </dd>
        </div>
        <div className={LINE}>
          <dt className={LABEL}>{t("col.current")}</dt>
          <dd className={cn(VALUE, FIGURE)}>{formatMoney(row.price, locale)}</dd>
        </div>
        <div className={LINE}>
          <dt className={LABEL}>{t("col.earnsNow")}</dt>
          <dd className={VALUE}>
            <span className={cn(FIGURE, "font-medium", losing && "text-error-foreground")}>
              {row.profitPerUnit === null ? "—" : formatMoney(row.profitPerUnit, locale)}
            </span>
            {row.profitPerUnit !== null && row.currentMarkupRate !== null ? (
              <span className={cn(FIELD_HINT, "whitespace-nowrap tabular-nums")}>
                {formatPercent(row.currentMarkupRate, locale)}
              </span>
            ) : null}
          </dd>
        </div>
      </dl>
    </article>
  );
}
