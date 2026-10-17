import { CircleAlert, Coffee, Package, Receipt, Users } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import type { PricingReport } from "@/src/domain/entities/Pricing";
import { Link } from "@/src/i18n/navigation";
import { formatCafeDayMedium, formatPercent } from "@/src/lib/formatCafeDay";
import { formatMoney } from "@/src/lib/formatMoney";
import { formatNumber } from "@/src/lib/formatNumber";
import { Badge, EmptyState } from "@/src/presentation/design-system";

import { StatCard } from "../StatCard";

import { ApplyPriceButton } from "./ApplyPriceButton";
import { ItemMarkupField } from "./ItemMarkupField";
import { PricingTabs } from "./PricingTabs";

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

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          label={t("summary.monthlyOverhead")}
          value={basis.monthlyOverhead === null ? "—" : formatMoney(basis.monthlyOverhead, locale)}
          hint={basis.source === "manual" ? t("summary.manual") : t("summary.fromBooks", { months: basis.months })}
          icon={Receipt}
          tone="warning"
        />
        <StatCard
          label={t("summary.monthlyUnits")}
          value={basis.monthlyUnits === null ? "—" : formatNumber(basis.monthlyUnits, locale)}
          hint={report.settings.expectedMonthlyUnits ? t("summary.expected") : t("summary.fromSales", { months: basis.months })}
          icon={Users}
          tone="info"
        />
        <StatCard
          label={t("summary.overheadPerUnit")}
          value={report.overheadPerUnit === null ? "—" : formatMoney(report.overheadPerUnit, locale)}
          hint={t("summary.defaultProfit", { percent: formatNumber(defaultPercent, locale, 1) })}
          icon={Package}
          tone="brand"
        />
      </div>

      {basis.fromDay && basis.toDay && basis.source === "ledger" ? (
        <p className="-mt-3 text-body-caption text-muted-foreground">
          {t("summary.span", { from: formatCafeDayMedium(basis.fromDay, locale), to: formatCafeDayMedium(basis.toDay, locale) })}
        </p>
      ) : null}

      {report.overheadPerUnit === null ? (
        <p className="flex items-start gap-2 rounded-card-md border border-warning-foreground bg-warning px-4 py-3 text-body-small text-warning-foreground">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            {t("noOverhead")}{" "}
            <Link href="/dashboard/pricing/settings" className="font-medium underline underline-offset-4">
              {t("tab.settings")}
            </Link>
          </span>
        </p>
      ) : null}

      <p className="text-body-small text-muted-foreground">{t("formula")}</p>

      <section className="min-w-0 overflow-x-auto rounded-card-lg border border-border bg-background">
        {report.rows.length === 0 ? (
          <EmptyState icon={Coffee} title={tProducts("emptyTitle")} description={tProducts("emptyBody")} />
        ) : (
          <table className="w-full min-w-[60rem] text-body-small">
            <thead className="bg-surface text-body-caption text-muted-foreground">
              <tr>
                <th scope="col" className="px-3 py-3 text-start font-medium">{t("col.item")}</th>
                <th scope="col" className="px-3 py-3 text-end font-medium">{t("col.ingredients")}</th>
                <th scope="col" className="px-3 py-3 text-end font-medium">{t("col.overhead")}</th>
                <th scope="col" className="px-3 py-3 text-end font-medium">{t("col.fullCost")}</th>
                <th scope="col" className="px-3 py-3 text-start font-medium">{t("col.profit")}</th>
                <th scope="col" className="px-3 py-3 text-end font-medium">{t("col.suggested")}</th>
                <th scope="col" className="px-3 py-3 text-end font-medium">{t("col.current")}</th>
                <th scope="col" className="px-3 py-3 text-end font-medium">{t("col.earnsNow")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {report.rows.map((row) => {
                const losing = row.profitPerUnit !== null && row.profitPerUnit < 0;
                return (
                  <tr key={row.productId} className="align-middle">
                    <td className="px-3 py-3">
                      <span className="block text-body-small-emphasis text-foreground" dir="auto">
                        {row.name}
                      </span>
                      <span className="flex flex-wrap items-center gap-1.5 text-body-caption text-muted-foreground">
                        {t(`kind.${row.kind}`)}
                        {row.taxExempt ? <Badge size="sm" variant="neutral">{t("vatExempt")}</Badge> : null}
                        · {t("perMonth", { count: formatNumber(row.monthlyUnits, locale, 1) })}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-end">
                      {row.directCost === null ? <span className="text-muted-foreground">—</span> : formatMoney(row.directCost, locale)}
                      <Link href={`/dashboard/pricing/recipes/${row.productId}`} className="block text-body-caption text-primary underline-offset-4 hover:underline">
                        {t(`costSource.${row.costSource}`)}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-end text-muted-foreground">{formatMoney(row.overheadPerUnit, locale)}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-end">{row.fullCost === null ? "—" : formatMoney(row.fullCost, locale)}</td>
                    <td className="px-3 py-3">
                      {canWrite ? (
                        <ItemMarkupField productId={row.productId} markupBps={row.markupIsDefault ? null : row.markupBps} defaultBps={report.settings.defaultMarkupBps} />
                      ) : (
                        <span>{formatNumber(row.markupBps / 100, locale, 1)}%</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-end text-body-small-emphasis text-foreground">
                      {row.suggestedPrice === null ? "—" : formatMoney(row.suggestedPrice, locale)}
                      {canApply && row.suggestedPrice !== null && row.suggestedPrice !== row.price ? (
                        <ApplyPriceButton productId={row.productId} name={row.name} currentPrice={row.price} suggestedPrice={row.suggestedPrice} />
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-end">{formatMoney(row.price, locale)}</td>
                    <td className={losing ? "whitespace-nowrap px-3 py-3 text-end text-error-foreground" : "whitespace-nowrap px-3 py-3 text-end"}>
                      {row.profitPerUnit === null ? (
                        "—"
                      ) : (
                        <>
                          {formatMoney(row.profitPerUnit, locale)}
                          {row.currentMarkupRate !== null ? (
                            <span className="block text-body-caption text-muted-foreground">{formatPercent(row.currentMarkupRate, locale)}</span>
                          ) : null}
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
