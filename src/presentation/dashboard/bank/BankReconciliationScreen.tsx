import { getLocale, getTranslations } from "next-intl/server";

import type { BankReconciliationView } from "@/src/domain/use-cases/accounting/BankReconciliation";
import { formatCafeDayMedium } from "@/src/lib/formatCafeDay";
import { formatNumber } from "@/src/lib/formatNumber";
import { Badge } from "@/src/presentation/design-system/components/Badge/Badge";

import { DashboardPageCrumb } from "../shell/DashboardPageCrumb";

import { BankMatchWorkspace } from "./BankMatchWorkspace";
import { ReconciliationHeader } from "./ReconciliationHeader";
import { ReconciliationSummaryPanel } from "./ReconciliationSummaryPanel";

/** One statement's reconciliation: the matching workspace, the proof and, while open, more lines. */
export async function BankReconciliationScreen({
  view,
  canWrite,
}: {
  view: BankReconciliationView;
  canWrite: boolean;
}) {
  const t = await getTranslations("dashBank");
  const locale = await getLocale();
  const { statement } = view;
  const period = `${formatCafeDayMedium(statement.fromDay, locale)} – ${formatCafeDayMedium(statement.toDay, locale)}`;

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <DashboardPageCrumb label={period} />
      <ReconciliationHeader
        title={t("statementTitle", { period })}
        subtitle={t("statementBalances", {
          opening: formatNumber(statement.openingBalance, locale),
          closing: formatNumber(statement.closingBalance, locale),
        })}
        badge={
          <Badge
            size="compact"
            appearance="outline"
            variant={statement.status === "reconciled" ? "success" : "warning"}
          >
            {t(`status.${statement.status}`)}
          </Badge>
        }
        statementId={statement.id}
        defaultDay={statement.toDay}
        canAddLines={canWrite && statement.status === "open"}
      />

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <BankMatchWorkspace
          statement={statement}
          candidates={view.candidates}
          suggestions={view.suggestions}
          canWrite={canWrite}
        />
        <ReconciliationSummaryPanel statement={statement} summary={view.summary} canWrite={canWrite} />
      </div>
    </div>
  );
}
