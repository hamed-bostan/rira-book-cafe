import { auth } from "@/auth";
import { parseDaySpan } from "@/src/lib/api/accounting-params";
import { toSearchParams } from "@/src/lib/api/searchParams";
import { requirePermission, sessionHas } from "@/src/lib/require-permission";
import { accountsServerApi, statementsServerApi } from "@/src/presentation/dashboard/accounting/accounting-server-api";
import { AccountingOverviewScreen } from "@/src/presentation/dashboard/accounting/AccountingOverviewScreen";

// The books are read over the REST API (BFF) during server render.
export const dynamic = "force-dynamic";

type AccountingPageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function AccountingPage({ searchParams }: AccountingPageProps) {
  await requirePermission("accounting.view");
  const { fromDay, toDay } = parseDaySpan(toSearchParams(await searchParams));

  const [trialBalance, profitAndLoss, settings, canWrite] = await Promise.all([
    statementsServerApi.trialBalance({}),
    statementsServerApi.profitAndLoss({ from: fromDay, to: toDay }),
    accountsServerApi.getSettings(),
    auth().then((session) => sessionHas(session, "accounting.write")),
  ]);

  return <AccountingOverviewScreen trialBalance={trialBalance} profitAndLoss={profitAndLoss} settings={settings} canWrite={canWrite} />;
}
