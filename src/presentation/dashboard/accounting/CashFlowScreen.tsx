import { getLocale, getTranslations } from "next-intl/server";

import type { CashFlowStatement } from "@/src/domain/entities/AccountingReports";
import { formatNumber } from "@/src/lib/formatNumber";
import { cn } from "@/src/lib/utils";

import { AMOUNT, PAGE_CARD, ROW_CAPTION, ROW_TEXT } from "../pageStyles";

import { BalanceCheck } from "./BalanceCheck";
import { StatementHeader } from "./StatementHeader";
import { StatementSectionTable } from "./StatementSectionTable";

/** Cash in and out by what it was for, then how the period took cash from where it started to where it ended. */
export async function CashFlowScreen({ report }: { report: CashFlowStatement }) {
  const t = await getTranslations("dashAccounting");
  const locale = await getLocale();

  const totals = [
    { key: "netChange", amount: report.netChange },
    { key: "openingCash", amount: report.openingCash },
    { key: "closingCash", amount: report.closingCash, strong: true },
  ] as const;

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <StatementHeader slug="cash-flow" span={report} />
      <BalanceCheck ok={report.reconciled} okLabel={t("cf.reconciled")} failLabel={t("cf.unreconciled")} />
      <StatementSectionTable
        heading={t("cf.operating")}
        section={report.operating}
        totalLabel={t("cf.netOperating")}
        empty={t("cf.noCash")}
      />
      <StatementSectionTable
        heading={t("cf.investing")}
        section={report.investing}
        totalLabel={t("cf.netInvesting")}
        empty={t("cf.noCash")}
      />
      <StatementSectionTable
        heading={t("cf.financing")}
        section={report.financing}
        totalLabel={t("cf.netFinancing")}
        empty={t("cf.noCash")}
      />
      <dl className={cn(PAGE_CARD, ROW_TEXT, "divide-y divide-border overflow-hidden")}>
        {totals.map((row) => (
          <div
            key={row.key}
            className={cn(
              "grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-4 px-5 py-4",
              "strong" in row && "bg-muted font-semibold",
            )}
          >
            <dt className="text-foreground">{t(`cf.${row.key}`)}</dt>
            <dd className={cn(AMOUNT, row.amount < 0 ? "text-error-foreground" : "text-foreground")}>
              {formatNumber(row.amount, locale)}
            </dd>
          </div>
        ))}
      </dl>
      <p className={ROW_CAPTION}>{t("cf.note")}</p>
    </div>
  );
}
