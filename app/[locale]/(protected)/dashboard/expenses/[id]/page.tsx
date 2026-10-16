import { notFound } from "next/navigation";

import { auth } from "@/auth";
import { cafeDayOf } from "@/src/domain/entities/CafeTime";
import { requirePermission, sessionHas } from "@/src/lib/require-permission";
import { accountsServerApi } from "@/src/presentation/dashboard/accounting/accounting-server-api";
import { expensesServerApi } from "@/src/presentation/dashboard/expenses/expense-server-api";
import { ExpenseDetailScreen } from "@/src/presentation/dashboard/expenses/ExpenseDetailScreen";

export const dynamic = "force-dynamic";

type ExpensePageProps = { params: Promise<{ id: string }> };

export default async function ExpensePage({ params }: ExpensePageProps) {
  await requirePermission("accounting.view");
  const { id } = await params;
  const [detail, accounts, canWrite] = await Promise.all([
    expensesServerApi.getById(id),
    accountsServerApi.list(),
    auth().then((session) => sessionHas(session, "accounting.write")),
  ]);
  if (!detail) notFound();

  return <ExpenseDetailScreen {...detail} accounts={accounts} canWrite={canWrite} today={cafeDayOf(new Date())} />;
}
