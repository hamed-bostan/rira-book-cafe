import { Receipt, Search, Truck } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { EXPENSE_STATUSES, type Supplier } from "@/src/domain/entities/Expense";
import type { Account } from "@/src/domain/entities/Ledger";
import { Link } from "@/src/i18n/navigation";
import { formatCafeDayMedium } from "@/src/lib/formatCafeDay";
import { formatMoney } from "@/src/lib/formatMoney";
import { accountName } from "@/src/presentation/dashboard/accounting/accounting-format";
import type { ExpensePageWire } from "@/src/presentation/dashboard/accounting/accounting-response-schema";
import { PeriodPicker } from "@/src/presentation/dashboard/accounting/PeriodPicker";
import { ListFilterSelect, ListPager } from "@/src/presentation/dashboard/list";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { EmptyState } from "@/src/presentation/design-system/components/EmptyState/EmptyState";

import { StatCard } from "../StatCard";

import { ExpenseStatusBadge } from "./ExpenseStatusBadge";

type ExpensesScreenProps = {
  page: ExpensePageWire;
  accounts: Account[];
  suppliers: Supplier[];
  fromDay: string;
  toDay: string;
  keep: Record<string, string>;
  canWrite: boolean;
};

/** Bills and purchases for a period, with what's owed to suppliers right now. */
export async function ExpensesScreen({
  page,
  accounts,
  suppliers,
  fromDay,
  toDay,
  keep,
  canWrite,
}: ExpensesScreenProps) {
  const t = await getTranslations("dashExpenses");
  const tList = await getTranslations("dashList");
  const locale = await getLocale();
  /** A status or supplier filter narrows the period — "no matches" rather than "nothing recorded". */
  const isFiltered = Boolean(keep.status || keep.supplier);
  const accountsByCode = new Map(accounts.map((account) => [account.code, account]));

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="dashboard-page-title">{t("heading")}</h1>
          <p className="mt-1 text-body-small text-muted-foreground">{t("subtitle")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href="/dashboard/expenses/suppliers">{t("suppliers.heading")}</Link>
          </Button>
          {canWrite ? (
            <Button asChild size="sm">
              <Link href="/dashboard/expenses/new">{t("new")}</Link>
            </Button>
          ) : null}
        </div>
      </div>

      <div className="max-w-sm">
        <StatCard
          label={t("owed")}
          value={formatMoney(page.totalUnpaid, locale)}
          icon={Truck}
          tone={page.totalUnpaid > 0 ? "warning" : "brand"}
        />
      </div>

      <div className="flex flex-col gap-4 rounded-card-lg border border-border bg-background p-4 md:flex-row md:items-start md:justify-between md:p-6">
        <PeriodPicker fromDay={fromDay} toDay={toDay} keep={keep} />
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-body-caption text-muted-foreground">
            {t("filterStatus")}
            <ListFilterSelect
              className="h-9 min-w-36"
              paramName="status"
              label={t("filterStatus")}
              options={[
                { value: "", label: t("allStatuses") },
                ...EXPENSE_STATUSES.map((status) => ({ value: status, label: t(`status.${status}`) })),
              ]}
            />
          </label>
          <label className="flex flex-col gap-1 text-body-caption text-muted-foreground">
            {t("filterSupplier")}
            <ListFilterSelect
              className="h-9 min-w-40"
              paramName="supplier"
              label={t("filterSupplier")}
              options={[
                { value: "", label: t("allSuppliers") },
                ...suppliers.map((supplier) => ({ value: supplier.id, label: supplier.name })),
              ]}
            />
          </label>
        </div>
      </div>

      <section className="min-w-0 overflow-hidden rounded-card-lg border border-border bg-background">
        {page.items.length === 0 ? (
          <EmptyState
            icon={isFiltered ? Search : Receipt}
            title={isFiltered ? tList("noResultsTitle") : t("empty")}
            description={isFiltered ? tList("noResultsBody") : undefined}
            action={
              !isFiltered && canWrite ? (
                <Button asChild size="sm">
                  <Link href="/dashboard/expenses/new">{t("new")}</Link>
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[44rem] text-body-small">
              <thead className="bg-surface text-body-caption text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-3 text-start font-medium">
                    {t("colNumber")}
                  </th>
                  <th scope="col" className="px-4 py-3 text-start font-medium">
                    {t("colDate")}
                  </th>
                  <th scope="col" className="px-4 py-3 text-start font-medium">
                    {t("colDescription")}
                  </th>
                  <th scope="col" className="px-4 py-3 text-start font-medium">
                    {t("colAccount")}
                  </th>
                  <th scope="col" className="px-4 py-3 text-start font-medium">
                    {t("colStatus")}
                  </th>
                  <th scope="col" className="px-4 py-3 text-end font-medium">
                    {t("colAmount")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {page.items.map((expense) => {
                  const account = accountsByCode.get(expense.accountCode);
                  return (
                    <tr key={expense.id} className="align-top">
                      <td className="px-4 py-3">
                        <Link
                          href={`/dashboard/expenses/${expense.id}`}
                          className="text-body-small-emphasis text-primary underline-offset-4 hover:underline"
                        >
                          EX-{expense.number}
                        </Link>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                        {formatCafeDayMedium(expense.date, locale)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="block text-foreground" dir="auto">
                          {expense.description}
                        </span>
                        {expense.supplierName ? (
                          <span className="text-body-caption text-muted-foreground">{expense.supplierName}</span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {account ? accountName(account, locale) : expense.accountCode}
                      </td>
                      <td className="px-4 py-3">
                        <ExpenseStatusBadge status={expense.status} />
                      </td>
                      <td
                        className={
                          expense.status === "void"
                            ? "px-4 py-3 text-end whitespace-nowrap text-muted-foreground line-through"
                            : "px-4 py-3 text-end text-body-small-emphasis whitespace-nowrap text-foreground"
                        }
                      >
                        {formatMoney(expense.amount, locale)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="border-t border-border px-4 py-3">
          <ListPager page={page} />
        </div>
      </section>
    </div>
  );
}
