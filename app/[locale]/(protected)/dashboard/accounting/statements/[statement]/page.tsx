import { notFound } from "next/navigation";

import { auth } from "@/auth";
import { cafeDayOf } from "@/src/domain/entities/CafeTime";
import { parseDaySpan } from "@/src/lib/api/accounting-params";
import { toSearchParams } from "@/src/lib/api/searchParams";
import { requirePermission, sessionHas } from "@/src/lib/require-permission";
import { isStatementSlug } from "@/src/presentation/dashboard/accounting/accounting-format";
import { statementsServerApi } from "@/src/presentation/dashboard/accounting/accounting-server-api";
import { BalanceSheetScreen } from "@/src/presentation/dashboard/accounting/BalanceSheetScreen";
import { MarginReportScreen } from "@/src/presentation/dashboard/accounting/MarginReportScreen";
import { ProfitAndLossScreen } from "@/src/presentation/dashboard/accounting/ProfitAndLossScreen";
import { TrialBalanceScreen } from "@/src/presentation/dashboard/accounting/TrialBalanceScreen";
import { VatReportScreen } from "@/src/presentation/dashboard/accounting/VatReportScreen";

export const dynamic = "force-dynamic";

type StatementPageProps = {
  params: Promise<{ statement: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function StatementPage({ params, searchParams }: StatementPageProps) {
  await requirePermission("accounting.view");
  const [{ statement }, query] = await Promise.all([params, searchParams]);
  if (!isStatementSlug(statement)) notFound();

  const search = toSearchParams(query);
  const asOf = { asOf: search.get("asOf") ?? cafeDayOf(new Date()) };
  const span = parseDaySpan(search);
  const period = { from: span.fromDay, to: span.toDay };

  switch (statement) {
    case "trial-balance":
      return <TrialBalanceScreen report={await statementsServerApi.trialBalance(asOf)} />;
    case "balance-sheet":
      return <BalanceSheetScreen report={await statementsServerApi.balanceSheet(asOf)} />;
    case "profit-and-loss":
      return <ProfitAndLossScreen report={await statementsServerApi.profitAndLoss(period)} />;
    case "vat": {
      const [report, canWrite] = await Promise.all([
        statementsServerApi.vat(period),
        auth().then((session) => sessionHas(session, "accounting.write")),
      ]);
      return <VatReportScreen report={report} canWrite={canWrite} />;
    }
    case "margins":
      return <MarginReportScreen report={await statementsServerApi.margins(period)} />;
  }
}
