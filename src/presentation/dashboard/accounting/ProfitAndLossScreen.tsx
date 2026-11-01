import { getLocale, getTranslations } from "next-intl/server";

import type { ProfitAndLoss } from "@/src/domain/entities/AccountingReports";
import { Link } from "@/src/i18n/navigation";
import { formatNumber } from "@/src/lib/formatNumber";
import { cn } from "@/src/lib/utils";

import { FormAlert } from "../FormAlert";
import { AMOUNT, ROW_CAPTION, ROW_TEXT } from "../pageStyles";

import { StatementHeader } from "./StatementHeader";
import { StatementSectionTable } from "./StatementSectionTable";

/** Revenue less cost of sales gives gross profit; less operating expenses, net profit. */
export async function ProfitAndLossScreen({ report }: { report: ProfitAndLoss }) {
  const t = await getTranslations("dashAccounting");
  const locale = await getLocale();

  const result = (label: string, amount: number, strong = false) => (
    <div
      className={cn(
        "grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-4 rounded-card-lg border px-5 py-4",
        strong ? "border-primary/40 bg-accent text-body-default" : cn("border-border bg-background", ROW_TEXT),
      )}
    >
      <span className="font-semibold text-foreground">{label}</span>
      <span className={cn(AMOUNT, "font-bold", amount < 0 ? "text-error-foreground" : "text-foreground")}>
        {formatNumber(amount, locale)}
      </span>
    </div>
  );

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <StatementHeader
        title={t("statements.profit-and-loss.title")}
        subtitle={t("statements.profit-and-loss.subtitle")}
        span={report}
      />
      {report.revenueWithoutCost > 0 ? (
        <FormAlert>
          {t("pl.withoutCost", { amount: formatNumber(report.revenueWithoutCost, locale) })}{" "}
          <Link href="/dashboard/inventory" className="underline">
            {t("pl.withoutCostLink")}
          </Link>
        </FormAlert>
      ) : null}
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
      <p className={ROW_CAPTION}>{t("pl.vatNote")}</p>
    </div>
  );
}
