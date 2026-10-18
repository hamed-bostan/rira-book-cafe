import { getLocale, getTranslations } from "next-intl/server";

import type { ProfitAndLoss } from "@/src/domain/entities/AccountingReports";
import { formatMoney } from "@/src/lib/formatMoney";

import { StatementHeader } from "./StatementHeader";
import { StatementSectionTable } from "./StatementSectionTable";

/** Revenue less cost of sales gives gross profit; less operating expenses, net profit. */
export async function ProfitAndLossScreen({ report }: { report: ProfitAndLoss }) {
  const t = await getTranslations("dashAccounting");
  const locale = await getLocale();

  const result = (label: string, amount: number, strong = false) => (
    <div
      className={
        strong
          ? "flex items-center justify-between gap-3 rounded-card-lg border border-primary/40 bg-accent px-4 py-4 text-body-lead"
          : "flex items-center justify-between gap-3 rounded-card-lg border border-border bg-surface px-4 py-3 text-body-strong"
      }
    >
      <span className="text-foreground">{label}</span>
      <span className={amount < 0 ? "text-error-foreground" : "text-foreground"}>{formatMoney(amount, locale)}</span>
    </div>
  );

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <StatementHeader
        title={t("statements.profit-and-loss.title")}
        subtitle={t("statements.profit-and-loss.subtitle")}
        span={report}
      />
      <StatementSectionTable
        heading={t("pl.revenue")}
        section={report.revenue}
        totalLabel={t("pl.totalRevenue")}
        empty={t("statements.noMovement")}
      />
      <StatementSectionTable
        heading={t("pl.costOfSales")}
        section={report.costOfSales}
        totalLabel={t("pl.totalCostOfSales")}
        empty={t("statements.noMovement")}
      />
      {result(t("pl.grossProfit"), report.grossProfit)}
      <StatementSectionTable
        heading={t("pl.expenses")}
        section={report.expenses}
        totalLabel={t("pl.totalExpenses")}
        empty={t("statements.noMovement")}
      />
      {result(report.netProfit < 0 ? t("pl.netLoss") : t("pl.netProfit"), report.netProfit, true)}
      <p className="text-body-caption text-muted-foreground">{t("pl.vatNote")}</p>
    </div>
  );
}
