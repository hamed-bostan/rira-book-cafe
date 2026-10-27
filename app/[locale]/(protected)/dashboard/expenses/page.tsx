import { auth } from "@/auth";
import { cafeDayOf } from "@/src/domain/entities/CafeTime";
import { buildExpenseParams, parseExpenseFilters } from "@/src/lib/api/accounting-params";
import { toSearchParams } from "@/src/lib/api/searchParams";
import { requirePermission, sessionHas } from "@/src/lib/require-permission";
import { accountsServerApi } from "@/src/presentation/dashboard/accounting/accounting-server-api";
import { expensesServerApi, suppliersServerApi } from "@/src/presentation/dashboard/expenses/expense-server-api";
import { ExpensesScreen } from "@/src/presentation/dashboard/expenses/ExpensesScreen";
import { withRememberedPageSize } from "@/src/presentation/dashboard/list/withRememberedPageSize";

export const dynamic = "force-dynamic";

type ExpensesPageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function ExpensesPage({ searchParams }: ExpensesPageProps) {
  await requirePermission("accounting.view");
  const params = await withRememberedPageSize(toSearchParams(await searchParams));
  // The list is every expense, newest first — the tab, search and supplier narrow it.
  const { status, supplierId, query } = parseExpenseFilters(params);

  const request = Object.fromEntries(buildExpenseParams({ status, supplierId, query }));
  for (const key of ["page", "pageSize"]) {
    const value = params.get(key);
    if (value) request[key] = value;
  }

  const [page, summary, accounts, suppliers, canWrite] = await Promise.all([
    expensesServerApi.list(request),
    expensesServerApi.getSummary(),
    accountsServerApi.list(),
    suppliersServerApi.list(true),
    auth().then((session) => sessionHas(session, "accounting.write")),
  ]);

  return (
    <ExpensesScreen
      page={page}
      summary={summary}
      accounts={accounts}
      suppliers={suppliers}
      status={status}
      supplierId={supplierId}
      query={query}
      today={cafeDayOf(new Date())}
      canWrite={canWrite}
      recordOnLoad={canWrite && params.get("record") === "1"}
    />
  );
}
