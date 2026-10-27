import { auth } from "@/auth";
import { cafeDayOf } from "@/src/domain/entities/CafeTime";
import { parseResultsPeriod, resultsPeriodSpan } from "@/src/lib/api/accounting-period-params";
import { toSearchParams } from "@/src/lib/api/searchParams";
import { requirePermission, sessionHas } from "@/src/lib/require-permission";
import { accountsServerApi, statementsServerApi } from "@/src/presentation/dashboard/accounting/accounting-server-api";
import { AccountingOverviewScreen } from "@/src/presentation/dashboard/accounting/AccountingOverviewScreen";

// The books are read over the REST API (BFF) during server render.
export const dynamic = "force-dynamic";

type AccountingPageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function AccountingPage({ searchParams }: AccountingPageProps) {
  await requirePermission("accounting.view");
  const period = parseResultsPeriod(toSearchParams(await searchParams));
  const { fromDay, toDay } = resultsPeriodSpan(period);

  const [trialBalance, profitAndLoss, settings, accounts, canWrite] = await Promise.all([
    statementsServerApi.trialBalance({}),
    statementsServerApi.profitAndLoss({ from: fromDay, to: toDay }),
    accountsServerApi.getSettings(),
    accountsServerApi.list(),
    auth().then((session) => sessionHas(session, "accounting.write")),
  ]);

  return (
    <AccountingOverviewScreen
      trialBalance={trialBalance}
      profitAndLoss={profitAndLoss}
      period={period}
      settings={settings}
      // The chart of accounts is for the writer's "New manual entry" only.
      accounts={canWrite ? accounts : null}
      today={cafeDayOf(new Date())}
    />
  );
}
