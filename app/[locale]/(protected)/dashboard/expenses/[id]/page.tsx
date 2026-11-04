import { notFound } from "next/navigation";

import { auth } from "@/auth";
import { cafeDayOf } from "@/src/domain/entities/CafeTime";
import { SYSTEM_ACCOUNTS } from "@/src/domain/entities/Ledger";
import { requirePermission, sessionHas } from "@/src/lib/require-permission";
import { accountsServerApi } from "@/src/presentation/dashboard/accounting/accounting-server-api";
import { expensesServerApi } from "@/src/presentation/dashboard/expenses/expense-server-api";
import { ExpenseDetailScreen } from "@/src/presentation/dashboard/expenses/ExpenseDetailScreen";
import { inventoryServerApi } from "@/src/presentation/dashboard/inventory/inventory-server-api";

export const dynamic = "force-dynamic";

type ExpensePageProps = { params: Promise<{ id: string }> };

export default async function ExpensePage({ params }: ExpensePageProps) {
  await requirePermission("accounting.view");
  const { id } = await params;
  const session = await auth();
  const [detail, accounts, canWrite, canSeeStock, canReturn] = await Promise.all([
    expensesServerApi.getById(id),
    accountsServerApi.list(),
    sessionHas(session, "accounting.write"),
    sessionHas(session, "inventory.view"),
    sessionHas(session, "inventory.manage"),
  ]);
  if (!detail) notFound();

  // A delivery's returns to the supplier, read where the viewer may read stock.
  const isDelivery = detail.expense.accountCode === SYSTEM_ACCOUNTS.inventory;
  const [returns, summary] =
    isDelivery && canSeeStock
      ? await Promise.all([inventoryServerApi.listReturns({ expense: id }), inventoryServerApi.getSummary()])
      : [[], null];

  return (
    <ExpenseDetailScreen
      {...detail}
      accounts={accounts}
      canWrite={canWrite}
      today={cafeDayOf(new Date())}
      returns={returns}
      stockUnits={new Map(summary?.items.map((item) => [item.id, item.unit]))}
      canReturn={canReturn}
    />
  );
}
