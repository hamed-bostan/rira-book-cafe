import { getTranslations } from "next-intl/server";

import type { BalanceSheet } from "@/src/domain/entities/AccountingReports";

import { BalanceCheck } from "./BalanceCheck";
import { StatementHeader } from "./StatementHeader";
import { StatementSectionTable } from "./StatementSectionTable";

/** What the cafe owns, owes, and the owner's stake, as of a day — and the check that they agree. */
export async function BalanceSheetScreen({ report }: { report: BalanceSheet }) {
  const t = await getTranslations("dashAccounting");

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <StatementHeader slug="balance-sheet" span={report} />
      <BalanceCheck ok={report.balanced} okLabel={t("bs.balanced")} failLabel={t("bs.unbalanced")} />
      <StatementSectionTable
        heading={t("accountType.asset")}
        section={report.assets}
        totalLabel={t("bs.totalAssets")}
        empty={t("statements.noMovement")}
      />
      <StatementSectionTable
        heading={t("accountType.liability")}
        section={report.liabilities}
        totalLabel={t("bs.totalLiabilities")}
        empty={t("statements.noMovement")}
      />
      <StatementSectionTable
        heading={t("accountType.equity")}
        section={report.equity}
        totalLabel={t("bs.totalEquity")}
        empty={t("statements.noMovement")}
        extra={[{ label: t("bs.currentEarnings"), amount: report.currentEarnings }]}
        total={report.totalEquity}
      />
    </div>
  );
}
