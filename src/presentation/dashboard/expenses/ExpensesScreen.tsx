import { Receipt, Truck } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import {
  EXPENSE_STATUSES,
  isExpenseTarget,
  type ExpenseStatus,
  type ExpenseSummary,
  type Supplier,
} from "@/src/domain/entities/Expense";
import type { Account } from "@/src/domain/entities/Ledger";
import { Link } from "@/src/i18n/navigation";
import { moneyUnit } from "@/src/lib/formatMoney";
import { formatNumber } from "@/src/lib/formatNumber";
import { cn } from "@/src/lib/utils";
import { accountName } from "@/src/presentation/dashboard/accounting/accounting-format";
import type { ExpensePageWire } from "@/src/presentation/dashboard/accounting/accounting-response-schema";
import { ListFilterSelect, ListPager, ListSearchInput } from "@/src/presentation/dashboard/list";
import { Button } from "@/src/presentation/design-system/components/Button/Button";

import { DashboardLinkTabs } from "../DashboardLinkTabs";
import { MetricCard } from "../MetricCard";

import { ExpenseDialogsProvider } from "./ExpenseDialogsProvider";
import { formatPersianMonth } from "./expenseFormat";
import { EXPENSE_ROW_GRID, ExpenseRow } from "./ExpenseRow";
import { RecordExpenseButton } from "./RecordExpenseButton";

/** The tabs along the top of the list: every expense, or one status. */
const EXPENSE_TABS = ["all", ...EXPENSE_STATUSES] as const;
type ExpenseTab = (typeof EXPENSE_TABS)[number];

type ExpensesScreenProps = {
  /** One page of the expenses in the current tab that match the search and supplier. */
  page: ExpensePageWire;
  /** What's owed, what was recorded this month, and each status's count. */
  summary: ExpenseSummary;
  accounts: Account[];
  /** Every supplier, switched off or not — the filter finds old bills too. */
  suppliers: Supplier[];
  status: ExpenseStatus | undefined;
  supplierId: string | undefined;
  query: string | undefined;
  /** Today on the cafe calendar. */
  today: string;
  canWrite: boolean;
  /** The page was reached as `/dashboard/expenses/new`: open "Record an expense". */
  recordOnLoad: boolean;
};

/**
 * Bills and purchases: what's owed to suppliers now and what was recorded this
 * month, then every expense in All / Owed / Paid / Void tabs with a search and a
 * supplier filter. Recording, paying and voiding open as dialogs. Presentational —
 * the page fetches over the REST API (BFF); the tab, search and supplier live in
 * the URL, and every write `router.refresh()`es.
 */
export async function ExpensesScreen({
  page,
  summary,
  accounts,
  suppliers,
  status,
  supplierId,
  query,
  today,
  canWrite,
  recordOnLoad,
}: ExpensesScreenProps) {
  const t = await getTranslations("dashExpenses");
  const locale = await getLocale();

  const accountsByCode = new Map(accounts.map((account) => [account.code, account]));
  const current: ExpenseTab = status ?? "all";
  const countOf = (tab: ExpenseTab): number =>
    tab === "all" ? summary.counts.unpaid + summary.counts.paid + summary.counts.void : summary.counts[tab];

  const hrefFor = (tab: ExpenseTab): string => {
    const params = new URLSearchParams();
    if (tab !== "all") params.set("status", tab);
    if (supplierId) params.set("supplier", supplierId);
    if (query) params.set("q", query);
    const qs = params.toString();
    return qs ? `/dashboard/expenses?${qs}` : "/dashboard/expenses";
  };

  // An empty list says "no matches" while there's anything in the books at all, and
  // "no expenses yet" only before the first one.
  const hasExpenses = countOf("all") > 0;

  return (
    <ExpenseDialogsProvider
      accounts={accounts.filter((account) => account.isActive && isExpenseTarget(account))}
      suppliers={suppliers.filter((supplier) => supplier.isActive)}
      today={today}
      recordOnLoad={recordOnLoad}
    >
      <div className="flex min-w-0 flex-col gap-6">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div className="flex min-w-0 flex-col gap-1">
            <h1 className="dashboard-page-title">{t("heading")}</h1>
            <p className="text-body-default text-pretty text-muted-foreground sm:text-body-small">{t("subtitle")}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="control-md" asChild variant="secondary" className="px-3">
              <Link href="/dashboard/expenses/suppliers">{t("suppliers.heading")}</Link>
            </Button>
            {canWrite ? <RecordExpenseButton /> : null}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <MetricCard
            label={t("owed")}
            icon={Truck}
            value={formatNumber(summary.owed.total, locale)}
            unit={moneyUnit(locale)}
            hint={
              summary.owed.count > 0
                ? t("owedHint", { count: summary.owed.count, formatted: formatNumber(summary.owed.count, locale) })
                : t("owedNone")
            }
            hintTone={summary.owed.count > 0 ? "warning" : undefined}
            hintDot={summary.owed.count > 0}
          />
          <MetricCard
            label={t("monthLabel", { month: formatPersianMonth(summary.month.fromDay, locale) })}
            icon={Receipt}
            value={formatNumber(summary.month.total, locale)}
            unit={moneyUnit(locale)}
            hint={t("monthHint", {
              count: summary.month.count,
              formatted: formatNumber(summary.month.count, locale),
            })}
          />
        </div>

        <section
          aria-label={t("listLabel")}
          className="@container/expenses min-w-0 rounded-card-lg border border-border bg-background shadow-xs"
        >
          <DashboardLinkTabs
            className="px-4"
            label={t("tabsLabel")}
            current={current}
            tabs={EXPENSE_TABS.map((tab) => ({
              key: tab,
              label: tab === "all" ? t("tabAll") : t(`status.${tab}`),
              count: countOf(tab),
              href: hrefFor(tab),
            }))}
          />
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border px-4 py-3">
            <ListSearchInput
              label={t("searchLabel")}
              placeholder={t("searchPlaceholder")}
              className="min-w-0 flex-[1_1_15rem] sm:max-w-md"
            />
            <ListFilterSelect
              paramName="supplier"
              label={t("filterSupplier")}
              className="w-48"
              options={[
                { value: "", label: t("allSuppliers") },
                ...suppliers.map((supplier) => ({ value: supplier.id, label: supplier.name })),
              ]}
            />
          </div>

          <div
            aria-hidden
            className={cn(
              "hidden h-10 items-center gap-x-4 border-b border-border bg-muted px-5 text-body-caption font-semibold tracking-wider whitespace-nowrap text-muted-foreground uppercase @[60rem]/expenses:grid",
              EXPENSE_ROW_GRID,
            )}
          >
            <span>{t("col.expense")}</span>
            <span>{t("col.date")}</span>
            <span>{t("col.account")}</span>
            <span>{t("col.status")}</span>
            <span className="text-end">{t("col.total")}</span>
            <span />
          </div>
          {page.items.length > 0 ? (
            <>
              <ul>
                {page.items.map((expense, index) => {
                  const account = accountsByCode.get(expense.accountCode);
                  return (
                    <li key={expense.id} className={cn(index > 0 && "border-t border-border")}>
                      <ExpenseRow
                        expense={expense}
                        accountName={account ? accountName(account, locale) : expense.accountCode}
                        canWrite={canWrite}
                      />
                    </li>
                  );
                })}
              </ul>
              {/* The list ends at its last row; the pager only comes in once there's a page to turn to. */}
              {page.total > page.pageSize || page.page > 1 ? (
                <div className="border-t border-border px-4 py-3">
                  <ListPager page={page} />
                </div>
              ) : null}
            </>
          ) : (
            <div className="flex flex-col items-center gap-1 px-5 py-12 text-center">
              <p className="text-body-strong text-foreground sm:text-body-small-strong">
                {hasExpenses ? t("noMatchesTitle") : t("emptyTitle")}
              </p>
              <p className="text-body-default text-muted-foreground sm:text-body-small">
                {hasExpenses ? t("noMatchesBody") : t("emptyBody")}
              </p>
            </div>
          )}
        </section>
      </div>
    </ExpenseDialogsProvider>
  );
}
