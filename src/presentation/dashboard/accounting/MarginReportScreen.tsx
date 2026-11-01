import { CircleAlert } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import type { MarginReport } from "@/src/domain/entities/AccountingReports";
import { formatPercent } from "@/src/lib/formatCafeDay";
import { formatNumber } from "@/src/lib/formatNumber";
import { cn } from "@/src/lib/utils";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";

import { AMOUNT, PAGE_CARD, ROW_TEXT, TABLE_HEAD, TABLE_TD, TABLE_TH } from "../pageStyles";

import { StatementHeader } from "./StatementHeader";

/** What each menu item earned net of VAT against what it cost, for sales completed in the period. */
export async function MarginReportScreen({ report }: { report: MarginReport }) {
  const t = await getTranslations("dashAccounting");
  const locale = await getLocale();
  const knownRevenue = report.totalNetRevenue - report.revenueWithoutCost;

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <StatementHeader
        title={t("statements.margins.title")}
        subtitle={t("statements.margins.subtitle")}
        span={report}
      />

      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {(
          [
            ["netRevenue", formatNumber(report.totalNetRevenue, locale)],
            ["cost", formatNumber(report.totalCost, locale)],
            ["grossProfit", formatNumber(report.totalGrossProfit, locale)],
            ["marginRate", knownRevenue > 0 ? formatPercent(report.totalGrossProfit / knownRevenue, locale) : "—"],
          ] as const
        ).map(([key, value]) => (
          <div key={key} className={cn(PAGE_CARD, "flex flex-col gap-1 px-5 py-4")}>
            <dt className={cn(ROW_TEXT, "font-medium text-foreground/80")}>{t(`margins.${key}`)}</dt>
            <dd className="text-heading-subsection font-bold text-foreground tabular-nums sm:text-heading-section">
              {value}
            </dd>
          </div>
        ))}
      </dl>
      {report.revenueWithoutCost > 0 ? (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-card-lg border border-warning-border bg-warning px-4 py-3 text-warning-foreground"
        >
          <Icon icon={CircleAlert} size="icon-md" className="mt-0.5" />
          <p className={cn(ROW_TEXT, "font-medium")}>
            {t("margins.missingCost", { amount: formatNumber(report.revenueWithoutCost, locale) })}
          </p>
        </div>
      ) : null}

      {report.rows.length === 0 ? (
        <section className={PAGE_CARD}>
          <p className={cn(ROW_TEXT, "px-5 py-12 text-center font-semibold text-foreground")}>{t("margins.empty")}</p>
        </section>
      ) : (
        <section className={cn(PAGE_CARD, "overflow-hidden")}>
          <div className="overflow-x-auto">
            <table className={cn(ROW_TEXT, "w-full min-w-2xl table-fixed")}>
              <thead className={TABLE_HEAD}>
                <tr>
                  <th scope="col" className={TABLE_TH}>
                    {t("margins.colItem")}
                  </th>
                  <th scope="col" className={cn(TABLE_TH, "w-24 text-end")}>
                    {t("margins.colQuantity")}
                  </th>
                  <th scope="col" className={cn(TABLE_TH, "w-36 text-end")}>
                    {t("margins.netRevenue")}
                  </th>
                  <th scope="col" className={cn(TABLE_TH, "w-36 text-end")}>
                    {t("margins.cost")}
                  </th>
                  <th scope="col" className={cn(TABLE_TH, "w-36 text-end")}>
                    {t("margins.grossProfit")}
                  </th>
                  <th scope="col" className={cn(TABLE_TH, "w-28 text-end")}>
                    {t("margins.marginRate")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {report.rows.map((row) => (
                  <tr key={row.productId}>
                    <td className={cn(TABLE_TD, "font-medium text-foreground")} dir="auto">
                      {row.name}
                    </td>
                    <td className={cn(TABLE_TD, AMOUNT)}>{formatNumber(row.quantity, locale)}</td>
                    <td className={cn(TABLE_TD, AMOUNT)}>{formatNumber(row.netRevenue, locale)}</td>
                    <td
                      className={cn(
                        TABLE_TD,
                        AMOUNT,
                        row.marginRate === null ? "text-warning-foreground" : "text-foreground",
                      )}
                    >
                      {row.marginRate === null ? t("margins.noCost") : formatNumber(row.cost, locale)}
                    </td>
                    <td className={cn(TABLE_TD, AMOUNT)}>
                      {row.marginRate === null ? "—" : formatNumber(row.grossProfit, locale)}
                    </td>
                    <td className={cn(TABLE_TD, AMOUNT, "font-semibold")}>
                      {row.marginRate === null ? "—" : formatPercent(row.marginRate, locale)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
