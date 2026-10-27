import { ChevronRight } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import type { Account } from "@/src/domain/entities/Ledger";
import { Link } from "@/src/i18n/navigation";
import { formatCafeDayMedium } from "@/src/lib/formatCafeDay";
import { formatMoney } from "@/src/lib/formatMoney";
import { accountLabel, entryTotal } from "@/src/presentation/dashboard/accounting/accounting-format";
import type { ExpenseDetailWire } from "@/src/presentation/dashboard/accounting/accounting-response-schema";

import { ExpenseStatusBadge } from "./ExpenseStatusBadge";
import { PayExpenseButton } from "./PayExpenseButton";
import { VoidExpenseButton } from "./VoidExpenseButton";

type ExpenseDetailScreenProps = ExpenseDetailWire & { accounts: Account[]; canWrite: boolean; today: string };

/** One expense: what it was, how it was booked and paid, and the journal entries behind it. */
export async function ExpenseDetailScreen({ expense, entries, accounts, canWrite, today }: ExpenseDetailScreenProps) {
  const t = await getTranslations("dashExpenses");
  const tAccounting = await getTranslations("dashAccounting");
  const locale = await getLocale();
  const account = accounts.find((candidate) => candidate.code === expense.accountCode);

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <nav
        aria-label={t("breadcrumbLabel")}
        className="flex items-center gap-2 text-body-caption text-muted-foreground"
      >
        <Link href="/dashboard/expenses" className="hover:text-foreground">
          {t("heading")}
        </Link>
        <ChevronRight className="size-3.5 rtl:rotate-180" aria-hidden />
        <span className="font-medium text-foreground">EX-{expense.number}</span>
      </nav>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <h1 className="dashboard-page-title">{t("detail.title", { number: expense.number })}</h1>
            <ExpenseStatusBadge status={expense.status} />
          </div>
          <p className="text-body text-foreground" dir="auto">
            {expense.description}
          </p>
          <p className="text-body-caption text-muted-foreground">
            {t("detail.recordedBy", { name: expense.createdByName })}
          </p>
        </div>
        {canWrite && expense.status !== "void" ? (
          <div className="flex flex-wrap gap-2">
            {expense.status === "unpaid" ? (
              <PayExpenseButton
                expense={{
                  id: expense.id,
                  number: expense.number,
                  date: expense.date,
                  description: expense.description,
                  amount: expense.amount,
                }}
                today={today}
              />
            ) : null}
            <VoidExpenseButton id={expense.id} number={expense.number} />
          </div>
        ) : null}
      </div>

      <dl className="grid grid-cols-1 gap-x-6 gap-y-4 rounded-card-lg border border-border bg-background p-4 sm:grid-cols-2 md:p-6">
        <div>
          <dt className="text-body-caption text-muted-foreground">{t("form.dateLabel")}</dt>
          <dd className="text-body-small-emphasis text-foreground">{formatCafeDayMedium(expense.date, locale)}</dd>
        </div>
        <div>
          <dt className="text-body-caption text-muted-foreground">{t("form.supplierLabel")}</dt>
          <dd className="text-body-small-emphasis text-foreground">{expense.supplierName ?? t("form.noSupplier")}</dd>
        </div>
        <div>
          <dt className="text-body-caption text-muted-foreground">{t("form.accountLabel")}</dt>
          <dd className="text-body-small-emphasis text-foreground">
            {account ? accountLabel(account, locale) : expense.accountCode}
          </dd>
        </div>
        <div>
          <dt className="text-body-caption text-muted-foreground">{t("detail.payment")}</dt>
          <dd className="text-body-small-emphasis text-foreground">
            {expense.paidFrom && expense.paidOn
              ? t("detail.paidFrom", {
                  source: t(`detail.source.${expense.paidFrom}`),
                  date: formatCafeDayMedium(expense.paidOn, locale),
                })
              : t("status.unpaid")}
          </dd>
        </div>
        <div>
          <dt className="text-body-caption text-muted-foreground">{t("detail.net")}</dt>
          <dd className="text-body-small-emphasis text-foreground">
            {formatMoney(expense.amount - expense.vatAmount, locale)}
          </dd>
        </div>
        <div>
          <dt className="text-body-caption text-muted-foreground">{t("detail.vat")}</dt>
          <dd className="text-body-small-emphasis text-foreground">{formatMoney(expense.vatAmount, locale)}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-body-caption text-muted-foreground">{t("detail.total")}</dt>
          <dd className="text-body-lead text-foreground">{formatMoney(expense.amount, locale)}</dd>
        </div>
      </dl>

      <section className="flex flex-col gap-3">
        <h2 className="text-body-lead text-foreground">{t("detail.entriesHeading")}</h2>
        <ul className="divide-y divide-border overflow-hidden rounded-card-lg border border-border bg-background">
          {entries.map((entry) => (
            <li key={entry.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-body-small">
              <Link
                href={`/dashboard/accounting/journal/${entry.id}`}
                className="text-body-small-emphasis text-primary underline-offset-4 hover:underline"
              >
                JE-{entry.number}
              </Link>
              <span className="text-muted-foreground">{formatCafeDayMedium(entry.date, locale)}</span>
              <span className="min-w-0 flex-1 truncate text-foreground">{tAccounting(`source.${entry.source}`)}</span>
              <span className="text-body-small-emphasis text-foreground">{formatMoney(entryTotal(entry), locale)}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
