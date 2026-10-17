import { ChartPie } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import type { MarginReport } from "@/src/domain/entities/AccountingReports";
import { formatPercent } from "@/src/lib/formatCafeDay";
import { formatMoney } from "@/src/lib/formatMoney";
import { formatNumber } from "@/src/lib/formatNumber";
import { EmptyState } from "@/src/presentation/design-system";

import { StatementHeader } from "./StatementHeader";

/** What each menu item earned net of VAT against what it cost, for sales completed in the period. */
export async function MarginReportScreen({ report }: { report: MarginReport }) {
  const t = await getTranslations("dashAccounting");
  const locale = await getLocale();
  const knownRevenue = report.totalNetRevenue - report.revenueWithoutCost;

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <StatementHeader title={t("statements.margins.title")} subtitle={t("statements.margins.subtitle")} span={report} />

      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 rounded-card-lg border border-border bg-background p-4 md:grid-cols-4 md:p-6">
        {(
          [
            ["netRevenue", formatMoney(report.totalNetRevenue, locale)],
            ["cost", formatMoney(report.totalCost, locale)],
            ["grossProfit", formatMoney(report.totalGrossProfit, locale)],
            ["marginRate", knownRevenue > 0 ? formatPercent(report.totalGrossProfit / knownRevenue, locale) : "—"],
          ] as const
        ).map(([key, value]) => (
          <div key={key} className="flex flex-col gap-1">
            <dt className="text-body-caption text-muted-foreground">{t(`margins.${key}`)}</dt>
            <dd className="text-body-strong text-foreground">{value}</dd>
          </div>
        ))}
      </dl>
      {report.revenueWithoutCost > 0 ? (
        <p className="rounded-card-md border border-warning-foreground bg-warning px-4 py-3 text-body-small text-warning-foreground">
          {t("margins.missingCost", { amount: formatMoney(report.revenueWithoutCost, locale) })}
        </p>
      ) : null}

      <section className="min-w-0 overflow-x-auto rounded-card-lg border border-border bg-background">
        {report.rows.length === 0 ? (
          <EmptyState icon={ChartPie} title={t("margins.empty")} />
        ) : (
          <table className="w-full min-w-[40rem] text-body-small">
            <thead className="bg-surface text-body-caption text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-3 text-start font-medium">{t("margins.colItem")}</th>
                <th scope="col" className="px-4 py-3 text-end font-medium">{t("margins.colQuantity")}</th>
                <th scope="col" className="px-4 py-3 text-end font-medium">{t("margins.netRevenue")}</th>
                <th scope="col" className="px-4 py-3 text-end font-medium">{t("margins.cost")}</th>
                <th scope="col" className="px-4 py-3 text-end font-medium">{t("margins.grossProfit")}</th>
                <th scope="col" className="px-4 py-3 text-end font-medium">{t("margins.marginRate")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {report.rows.map((row) => (
                <tr key={row.productId}>
                  <td className="px-4 py-2.5 text-foreground" dir="auto">
                    {row.name}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-end">{formatNumber(row.quantity, locale)}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-end">{formatMoney(row.netRevenue, locale)}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-end">{row.marginRate === null ? t("margins.noCost") : formatMoney(row.cost, locale)}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-end">{row.marginRate === null ? "—" : formatMoney(row.grossProfit, locale)}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-end text-body-small-emphasis">{row.marginRate === null ? "—" : formatPercent(row.marginRate, locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
