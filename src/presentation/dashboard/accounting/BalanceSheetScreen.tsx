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
      <StatementHeader title={t("statements.balance-sheet.title")} subtitle={t("statements.balance-sheet.subtitle")} span={report} />
      <BalanceCheck ok={report.balanced} okLabel={t("bs.balanced")} failLabel={t("bs.unbalanced")} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <StatementSectionTable heading={t("accountType.asset")} section={report.assets} totalLabel={t("bs.totalAssets")} empty={t("statements.noMovement")} />
        <div className="flex flex-col gap-6">
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
      </div>
    </div>
  );
}
