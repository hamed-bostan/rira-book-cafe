import { getLocale, getTranslations } from "next-intl/server";

import { amountOwed } from "@/src/domain/entities/Expense";
import type { Account } from "@/src/domain/entities/Ledger";
import { Link } from "@/src/i18n/navigation";
import { formatCafeDayMedium } from "@/src/lib/formatCafeDay";
import { formatMoney } from "@/src/lib/formatMoney";
import { cn } from "@/src/lib/utils";
import { accountLabel, entryTotal } from "@/src/presentation/dashboard/accounting/accounting-format";
import type { ExpenseDetailWire } from "@/src/presentation/dashboard/accounting/accounting-response-schema";
import { Badge } from "@/src/presentation/design-system/components/Badge/Badge";

import { DashboardPageHeader } from "../DashboardPageHeader";
import { DashboardSection } from "../DashboardSection";
import { AMOUNT, ROW_CAPTION } from "../pageStyles";
import { DashboardPageCrumb } from "../shell/DashboardPageCrumb";

import { ExpenseReceiptEditor } from "./ExpenseReceiptEditor";
import { ExpenseReceiptPreview } from "./ExpenseReceiptPreview";
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

  const details: { key: string; label: string; value: string; figure?: boolean; strong?: boolean }[] = [
    { key: "date", label: t("form.dateLabel"), value: formatCafeDayMedium(expense.date, locale) },
    { key: "supplier", label: t("form.supplierLabel"), value: expense.supplierName ?? t("form.noSupplier") },
    {
      key: "account",
      label: t("form.accountLabel"),
      value: account ? accountLabel(account, locale) : expense.accountCode,
    },
    {
      key: "payment",
      label: t("detail.payment"),
      value:
        expense.paidFrom && expense.paidOn
          ? t("detail.paidFrom", {
              source: t(`detail.source.${expense.paidFrom}`),
              date: formatCafeDayMedium(expense.paidOn, locale),
            })
          : expense.paidAmount > 0
            ? t("detail.paidSoFar", {
                paid: formatMoney(expense.paidAmount, locale),
                left: formatMoney(amountOwed(expense), locale),
              })
            : t("status.unpaid"),
    },
    {
      key: "net",
      label: t("detail.net"),
      value: formatMoney(expense.amount - expense.vatAmount, locale),
      figure: true,
    },
    { key: "vat", label: t("detail.vat"), value: formatMoney(expense.vatAmount, locale), figure: true },
    { key: "total", label: t("detail.total"), value: formatMoney(expense.amount, locale), figure: true, strong: true },
  ];

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <DashboardPageCrumb label={`EX-${expense.number}`} />
      <DashboardPageHeader
        backHref="/dashboard/expenses"
        backLabel={t("heading")}
        title={t("detail.title", { number: expense.number })}
        badge={<ExpenseStatusBadge status={expense.status} standalone />}
        subtitle={t("detail.recordedBy", { name: expense.createdByName })}
        actions={
          canWrite && expense.status !== "void" ? (
            <>
              <VoidExpenseButton id={expense.id} number={expense.number} />
              {expense.status === "unpaid" ? (
                <PayExpenseButton
                  expense={{
                    id: expense.id,
                    number: expense.number,
                    date: expense.date,
                    description: expense.description,
                    amount: expense.amount,
                    paidAmount: expense.paidAmount,
                  }}
                  today={today}
                />
              ) : null}
            </>
          ) : undefined
        }
      />

      <DashboardSection title={<span dir="auto">{expense.description}</span>} flush>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-5 p-5 lg:grid-cols-4">
          {details.map((detail) => (
            <div key={detail.key} className="flex min-w-0 flex-col gap-0.5">
              <dt className={ROW_CAPTION}>{detail.label}</dt>
              <dd
                className={cn(
                  "text-foreground",
                  detail.figure && "tabular-nums",
                  detail.strong ? "font-semibold" : "font-medium",
                )}
              >
                {detail.value}
              </dd>
            </div>
          ))}
        </dl>
      </DashboardSection>

      {canWrite && expense.status !== "void" ? (
        <DashboardSection title={t("receipt.heading")}>
          <ExpenseReceiptEditor id={expense.id} receiptUrl={expense.receiptUrl} />
        </DashboardSection>
      ) : expense.receiptUrl ? (
        <DashboardSection title={t("receipt.heading")}>
          <ExpenseReceiptPreview src={expense.receiptUrl} />
        </DashboardSection>
      ) : null}

      <DashboardSection title={t("detail.entriesHeading")} className="overflow-hidden" flush>
        <ul className="divide-y divide-border">
          {entries.map((entry) => (
            <li key={entry.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3">
              <span className="flex min-w-48 flex-1 flex-col gap-0.5">
                <Link
                  href={`/dashboard/accounting/journal/${entry.id}`}
                  className="-my-3 w-fit py-3 font-medium text-primary hover:text-primary-hover sm:my-0 sm:py-0"
                >
                  JE-{entry.number}
                </Link>
                <span className={ROW_CAPTION}>{formatCafeDayMedium(entry.date, locale)}</span>
              </span>
              <Badge size="compact" variant="neutral" appearance="outline">
                {tAccounting(`source.${entry.source}`)}
              </Badge>
              <span className={cn(AMOUNT, "ms-auto min-w-28 font-semibold text-foreground")}>
                {formatMoney(entryTotal(entry), locale)}
              </span>
            </li>
          ))}
        </ul>
      </DashboardSection>
    </div>
  );
}
