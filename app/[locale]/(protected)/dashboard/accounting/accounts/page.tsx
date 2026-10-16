import { auth } from "@/auth";
import { requirePermission, sessionHas } from "@/src/lib/require-permission";
import { accountsServerApi, statementsServerApi } from "@/src/presentation/dashboard/accounting/accounting-server-api";
import { AccountsScreen } from "@/src/presentation/dashboard/accounting/AccountsScreen";

export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  await requirePermission("accounting.view");
  const [accounts, trialBalance, canWrite] = await Promise.all([
    accountsServerApi.list(),
    statementsServerApi.trialBalance({}),
    auth().then((session) => sessionHas(session, "accounting.write")),
  ]);

  return <AccountsScreen accounts={accounts} trialBalance={trialBalance} canWrite={canWrite} />;
}
