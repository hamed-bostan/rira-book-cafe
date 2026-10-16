import { auth } from "@/auth";
import { buildExpenseParams, parseDaySpan, parseExpenseFilters } from "@/src/lib/api/accounting-params";
import { toSearchParams } from "@/src/lib/api/searchParams";
import { requirePermission, sessionHas } from "@/src/lib/require-permission";
import { accountsServerApi } from "@/src/presentation/dashboard/accounting/accounting-server-api";
import { expensesServerApi, suppliersServerApi } from "@/src/presentation/dashboard/expenses/expense-server-api";
import { ExpensesScreen } from "@/src/presentation/dashboard/expenses/ExpensesScreen";

export const dynamic = "force-dynamic";

type ExpensesPageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function ExpensesPage({ searchParams }: ExpensesPageProps) {
  await requirePermission("accounting.view");
  const params = toSearchParams(await searchParams);
  const { fromDay, toDay } = parseDaySpan(params);
  const filters = { ...parseExpenseFilters(params), fromDay, toDay };

  const keep = Object.fromEntries(buildExpenseParams({ ...filters, fromDay: undefined, toDay: undefined }));
  const query: Record<string, string> = { ...Object.fromEntries(buildExpenseParams(filters)) };
  for (const key of ["page", "pageSize"]) {
    const value = params.get(key);
    if (value) query[key] = value;
  }

  const [page, accounts, suppliers, canWrite] = await Promise.all([
    expensesServerApi.list(query),
    accountsServerApi.list(),
    suppliersServerApi.list(true),
    auth().then((session) => sessionHas(session, "accounting.write")),
  ]);

  return (
    <ExpensesScreen page={page} accounts={accounts} suppliers={suppliers} fromDay={fromDay} toDay={toDay} keep={keep} canWrite={canWrite} />
  );
}
