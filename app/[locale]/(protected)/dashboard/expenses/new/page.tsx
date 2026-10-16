import { getTranslations } from "next-intl/server";

import { cafeDayOf } from "@/src/domain/entities/CafeTime";
import { isExpenseTarget } from "@/src/domain/entities/Expense";
import { requirePermission } from "@/src/lib/require-permission";
import { accountsServerApi } from "@/src/presentation/dashboard/accounting/accounting-server-api";
import { suppliersServerApi } from "@/src/presentation/dashboard/expenses/expense-server-api";
import { ExpenseForm } from "@/src/presentation/dashboard/expenses/ExpenseForm";

export const dynamic = "force-dynamic";

export default async function NewExpensePage() {
  await requirePermission("accounting.write");
  const [t, accounts, suppliers] = await Promise.all([
    getTranslations("dashExpenses"),
    accountsServerApi.list(),
    suppliersServerApi.list(false),
  ]);

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="dashboard-page-title">{t("form.title")}</h1>
        <p className="text-body-small text-muted-foreground">{t("form.subtitle")}</p>
      </div>
      <ExpenseForm
        accounts={accounts.filter((account) => account.isActive && isExpenseTarget(account))}
        suppliers={suppliers}
        today={cafeDayOf(new Date())}
      />
    </div>
  );
}
