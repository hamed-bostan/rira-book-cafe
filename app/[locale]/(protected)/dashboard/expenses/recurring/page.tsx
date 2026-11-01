import { auth } from "@/auth";
import { isExpenseTarget } from "@/src/domain/entities/Expense";
import { requirePermission, sessionHas } from "@/src/lib/require-permission";
import { accountsServerApi } from "@/src/presentation/dashboard/accounting/accounting-server-api";
import { recurringBillsServerApi, suppliersServerApi } from "@/src/presentation/dashboard/expenses/expense-server-api";
import { RecurringBillsScreen } from "@/src/presentation/dashboard/expenses/RecurringBillsScreen";

export const dynamic = "force-dynamic";

export default async function RecurringBillsPage() {
  await requirePermission("accounting.view");
  const [bills, accounts, suppliers, canWrite] = await Promise.all([
    recurringBillsServerApi.list(),
    accountsServerApi.list(),
    suppliersServerApi.list(false),
    auth().then((session) => sessionHas(session, "accounting.write")),
  ]);

  return (
    <RecurringBillsScreen
      bills={bills}
      accounts={accounts.filter((account) => account.isActive && isExpenseTarget(account))}
      suppliers={suppliers}
      canWrite={canWrite}
    />
  );
}
