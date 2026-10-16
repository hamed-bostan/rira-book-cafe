import { ChevronRight } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import type { BankReconciliationView } from "@/src/domain/use-cases/accounting/BankReconciliation";
import { Link } from "@/src/i18n/navigation";
import { formatCafeDayMedium } from "@/src/lib/formatCafeDay";
import { formatMoney } from "@/src/lib/formatMoney";
import { Badge } from "@/src/presentation/design-system";

import { AddStatementLinesForm } from "./AddStatementLinesForm";
import { BankMatchWorkspace } from "./BankMatchWorkspace";
import { ReconciliationSummaryPanel } from "./ReconciliationSummaryPanel";

/** One statement's reconciliation: the proof, the matching workspace and, while open, more lines. */
export async function BankReconciliationScreen({ view, canWrite }: { view: BankReconciliationView; canWrite: boolean }) {
  const t = await getTranslations("dashBank");
  const tAccounting = await getTranslations("dashAccounting");
  const locale = await getLocale();
  const { statement } = view;
  const period = `${formatCafeDayMedium(statement.fromDay, locale)} – ${formatCafeDayMedium(statement.toDay, locale)}`;

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <nav aria-label={tAccounting("breadcrumbLabel")} className="flex items-center gap-2 text-body-caption text-muted-foreground">
        <Link href="/dashboard/accounting/bank" className="hover:text-foreground">
          {t("heading")}
        </Link>
        <ChevronRight className="size-3.5 rtl:rotate-180" aria-hidden />
        <span className="font-medium text-foreground">{period}</span>
      </nav>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="dashboard-page-title">{t("statementTitle", { period })}</h1>
          <p className="mt-1 text-body-small text-muted-foreground">
            {t("statementBalances", { opening: formatMoney(statement.openingBalance, locale), closing: formatMoney(statement.closingBalance, locale) })}
          </p>
        </div>
        <Badge variant={statement.status === "reconciled" ? "success" : "warning"}>{t(`status.${statement.status}`)}</Badge>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <ReconciliationSummaryPanel statement={statement} summary={view.summary} canWrite={canWrite} />
        <BankMatchWorkspace statement={statement} candidates={view.candidates} suggestions={view.suggestions} canWrite={canWrite} />
      </div>

      {canWrite && statement.status === "open" ? <AddStatementLinesForm statementId={statement.id} defaultDay={statement.toDay} /> : null}
    </div>
  );
}
