import { CircleAlert, Package, Receipt, Users } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import type { PricingReport } from "@/src/domain/entities/Pricing";
import { Link } from "@/src/i18n/navigation";
import { formatCafeDayMedium, formatPercent } from "@/src/lib/formatCafeDay";
import { formatMoney, moneyUnit } from "@/src/lib/formatMoney";
import { formatNumber, formatNumberTrimmed } from "@/src/lib/formatNumber";
import { cn } from "@/src/lib/utils";
import { Badge } from "@/src/presentation/design-system/components/Badge/Badge";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";

import { DashboardEmptyState } from "../DashboardEmptyState";
import { FIELD_HINT, OVERLINE } from "../fieldStyles";
import { MetricCard } from "../MetricCard";

import { ApplyPriceButton } from "./ApplyPriceButton";
import { ItemMarkupField } from "./ItemMarkupField";
import { PricingTabs } from "./PricingTabs";

/** A column's title: small capitals, wrapping onto a second line where it's long. */
const HEAD = cn(OVERLINE, "px-2 py-2 align-bottom first:ps-5 last:pe-5");
/** The first and last cells carry the card's 20px inset, the rest a 16px gap between them. */
const CELL = "px-2 py-3 align-top first:ps-5 last:pe-5";
/** A cell's figure and whatever sits under it, right-aligned. */
const STACK = "flex flex-col items-end gap-0.5";
const FIGURE = "whitespace-nowrap text-foreground tabular-nums";

type PricingScreenProps = {
  report: PricingReport;
  canWrite: boolean;
  /** Applying a price changes the menu, so it also needs `catalog.write`. */
  canApply: boolean;
};

/**
 * Every menu item's real cost — ingredients plus its share of the running costs —
 * the owner's profit target, the price that earns it, and what the item earns at
 * today's price.
 */
export async function PricingScreen({ report, canWrite, canApply }: PricingScreenProps) {
  const t = await getTranslations("dashPricing");
  const tProducts = await getTranslations("dashProducts");
  const locale = await getLocale();
  const { basis } = report;
  const defaultPercent = report.settings.defaultMarkupBps / 100;

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <PricingTabs active="items" title={t("heading")} subtitle={t("subtitle")} />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <MetricCard
          label={t("summary.monthlyOverhead")}
          icon={Receipt}
          value={basis.monthlyOverhead === null ? "—" : formatNumber(basis.monthlyOverhead, locale)}
          unit={basis.monthlyOverhead === null ? undefined : moneyUnit(locale)}
          hint={
            basis.source === "manual"
              ? t("summary.manual")
              : t("summary.fromBooks", { months: formatNumber(basis.months, locale) })
          }
        />
        <MetricCard
          label={t("summary.monthlyUnits")}
          icon={Users}
          value={basis.monthlyUnits === null ? "—" : formatNumber(basis.monthlyUnits, locale)}
          hint={
            report.settings.expectedMonthlyUnits
              ? t("summary.expected")
              : t("summary.fromSales", { months: formatNumber(basis.months, locale) })
          }
        />
        <MetricCard
          label={t("summary.overheadPerUnit")}
          icon={Package}
          value={report.overheadPerUnit === null ? "—" : formatNumber(report.overheadPerUnit, locale)}
          unit={report.overheadPerUnit === null ? undefined : moneyUnit(locale)}
          hint={t("summary.defaultProfit", { percent: formatNumberTrimmed(defaultPercent, locale, 1) })}
        />
      </div>

      {basis.fromDay && basis.toDay && basis.source === "ledger" ? (
        <p className={FIELD_HINT}>
          {t("summary.span", {
            from: formatCafeDayMedium(basis.fromDay, locale),
            to: formatCafeDayMedium(basis.toDay, locale),
          })}
        </p>
      ) : null}

      {report.overheadPerUnit === null ? (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-card-lg border border-warning-border bg-warning px-4 py-3 text-warning-foreground"
        >
          <Icon icon={CircleAlert} size="icon-lg" />
          <p className="text-body-default font-medium text-pretty sm:text-body-small">
            {t("noOverhead")}{" "}
            <Link href="/dashboard/pricing/settings" className="font-semibold underline">
              {t("tab.settings")}
            </Link>
          </p>
        </div>
      ) : null}

      <p className={FIELD_HINT}>{t("formula")}</p>

      <section className="min-w-0 overflow-hidden rounded-card-lg border border-border bg-background shadow-xs">
        {report.rows.length === 0 ? (
          <DashboardEmptyState title={tProducts("emptyTitle")} body={tProducts("emptyBody")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[83.5rem] table-fixed text-body-default sm:text-body-small">
              <colgroup>
                <col className="w-[13.75rem]" />
                <col className="w-52" />
                <col className="w-36" />
                <col className="w-36" />
                <col className="w-32" />
                <col className="w-44" />
                <col className="w-36" />
                <col className="w-[10.75rem]" />
              </colgroup>
              <thead className="border-b border-border bg-muted">
                <tr>
                  <th scope="col" className={cn(HEAD, "text-start")}>
                    {t("col.item")}
                  </th>
                  <th scope="col" className={cn(HEAD, "text-end")}>
                    {t("col.ingredients")}
                  </th>
                  <th scope="col" className={cn(HEAD, "text-end")}>
                    {t("col.overhead")}
                  </th>
                  <th scope="col" className={cn(HEAD, "text-end")}>
                    {t("col.fullCost")}
                  </th>
                  <th scope="col" className={cn(HEAD, "text-end")}>
                    {t("col.profit")}
                  </th>
                  <th scope="col" className={cn(HEAD, "text-end")}>
                    {t("col.suggested")}
                  </th>
                  <th scope="col" className={cn(HEAD, "text-end")}>
                    {t("col.current")}
                  </th>
                  <th scope="col" className={cn(HEAD, "text-end")}>
                    {t("col.earnsNow")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {report.rows.map((row) => {
                  const losing = row.profitPerUnit !== null && row.profitPerUnit < 0;
                  return (
                    <tr key={row.productId}>
                      <td className={CELL}>
                        <div className="flex flex-col items-start gap-0.5">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="font-semibold text-foreground" dir="auto">
                              {row.name}
                            </span>
                            {row.taxExempt ? (
                              <Badge variant="neutral" appearance="outline" size="compact">
                                {t("vatExempt")}
                              </Badge>
                            ) : null}
                          </div>
                          <span className={FIELD_HINT}>
                            {t(`kind.${row.kind}`)} ·{" "}
                            {t("perMonth", { count: formatNumberTrimmed(row.monthlyUnits, locale, 1) })}
                          </span>
                        </div>
                      </td>
                      <td className={CELL}>
                        <div className={STACK}>
                          <span className={FIGURE}>
                            {row.directCost === null ? "—" : formatMoney(row.directCost, locale)}
                          </span>
                          <Link
                            href={`/dashboard/pricing/recipes/${row.productId}`}
                            className="-my-3 py-3 text-body-small font-medium whitespace-nowrap text-primary transition-colors hover:text-primary-hover hover:underline sm:my-0 sm:py-0 sm:text-body-caption"
                          >
                            {t(`costSource.${row.costSource}`)}
                          </Link>
                        </div>
                      </td>
                      <td className={cn(CELL, FIGURE, "text-end")}>{formatMoney(row.overheadPerUnit, locale)}</td>
                      <td className={cn(CELL, FIGURE, "text-end font-medium")}>
                        {row.fullCost === null ? "—" : formatMoney(row.fullCost, locale)}
                      </td>
                      <td className={CELL}>
                        {canWrite ? (
                          <ItemMarkupField
                            productId={row.productId}
                            markupBps={row.markupIsDefault ? null : row.markupBps}
                            defaultBps={report.settings.defaultMarkupBps}
                          />
                        ) : (
                          <span className="block text-end text-foreground tabular-nums">
                            {formatNumberTrimmed(row.markupBps / 100, locale, 1)}%
                          </span>
                        )}
                      </td>
                      <td className={CELL}>
                        <div className={STACK}>
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
                        </div>
                      </td>
                      <td className={cn(CELL, FIGURE, "text-end")}>{formatMoney(row.price, locale)}</td>
                      <td className={CELL}>
                        <div className={STACK}>
                          <span className={cn(FIGURE, "font-medium", losing && "text-error-foreground")}>
                            {row.profitPerUnit === null ? "—" : formatMoney(row.profitPerUnit, locale)}
                          </span>
                          {row.profitPerUnit !== null && row.currentMarkupRate !== null ? (
                            <span className={cn(FIELD_HINT, "whitespace-nowrap tabular-nums")}>
                              {formatPercent(row.currentMarkupRate, locale)}
                            </span>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
