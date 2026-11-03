import { getLocale, getTranslations } from "next-intl/server";

import type { Supplier } from "@/src/domain/entities/Expense";
import type { Account } from "@/src/domain/entities/Ledger";
import type { RecurringBill } from "@/src/domain/entities/RecurringBill";
import { formatMoney } from "@/src/lib/formatMoney";
import { formatNumber } from "@/src/lib/formatNumber";
import { cn } from "@/src/lib/utils";
import { accountLabel } from "@/src/presentation/dashboard/accounting/accounting-format";
import { Badge } from "@/src/presentation/design-system/components/Badge/Badge";

import { DashboardPageHeader } from "../DashboardPageHeader";
import { AMOUNT, PAGE_CARD, ROW_CAPTION, ROW_END, ROW_TEXT } from "../pageStyles";
import { DashboardPageCrumb } from "../shell/DashboardPageCrumb";

import { RecurringBillDialog } from "./RecurringBillDialog";

type RecurringBillsScreenProps = {
  bills: RecurringBill[];
  /** Accounts a bill can be booked to. */
  accounts: Account[];
  /** Suppliers still bought from. */
  suppliers: Supplier[];
  canWrite: boolean;
};

/**
 * Bills that come round every month. Setting one up books nothing: each month waits
 * on the Expenses page for someone to record or skip. Bills are switched off rather
 * than deleted, so the months they've been through stay on record.
 */
export async function RecurringBillsScreen({ bills, accounts, suppliers, canWrite }: RecurringBillsScreenProps) {
  const t = await getTranslations("dashExpenses");
  const locale = await getLocale();
  const accountsByCode = new Map(accounts.map((account) => [account.code, account]));

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <DashboardPageCrumb label={t("recurring.heading")} />
      <DashboardPageHeader
        backHref="/dashboard/expenses"
        backLabel={t("heading")}
        title={t("recurring.heading")}
        subtitle={t("recurring.subtitle")}
        actions={canWrite ? <RecurringBillDialog accounts={accounts} suppliers={suppliers} /> : undefined}
      />

      <section aria-label={t("recurring.heading")} className={cn(PAGE_CARD, ROW_TEXT, "overflow-hidden")}>
        {bills.length === 0 ? (
          <p className="px-5 py-12 text-center font-semibold text-foreground">{t("recurring.empty")}</p>
        ) : (
          <ul className="divide-y divide-border">
            {bills.map((bill) => {
              const account = accountsByCode.get(bill.accountCode);
              return (
                <li key={bill.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
                  <span className="flex min-w-48 flex-1 flex-col gap-0.5">
                    <span className="flex flex-wrap items-center gap-2">
                      <span
                        className={cn("font-semibold", bill.isActive ? "text-foreground" : "text-muted-foreground")}
                        dir="auto"
                      >
                        {bill.description}
                      </span>
                      {!bill.isActive ? (
                        <Badge size="compact" variant="neutral" appearance="outline">
                          {t("recurring.inactive")}
                        </Badge>
                      ) : null}
                    </span>
                    <span className={ROW_CAPTION}>
                      {account ? accountLabel(account, locale) : bill.accountCode}
                      {bill.supplierName ? ` · ${bill.supplierName}` : ""}
                    </span>
                  </span>
                  <span className={ROW_END}>
                    <span className="flex min-w-32 flex-col items-end gap-0.5">
                      <span className={cn(AMOUNT, "font-semibold text-foreground")}>
                        {formatMoney(bill.amount, locale)}
                      </span>
                      <span className={ROW_CAPTION}>
                        {t("recurring.every", { day: formatNumber(bill.dayOfMonth, locale) })}
                      </span>
                    </span>
                    {canWrite ? <RecurringBillDialog bill={bill} accounts={accounts} suppliers={suppliers} /> : null}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
