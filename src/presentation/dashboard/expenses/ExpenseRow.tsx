import { getLocale, getTranslations } from "next-intl/server";

import type { Expense } from "@/src/domain/entities/Expense";
import { Link } from "@/src/i18n/navigation";
import { formatCafeDayShort } from "@/src/lib/formatCafeDay";
import { formatNumber } from "@/src/lib/formatNumber";
import { cn } from "@/src/lib/utils";
import { focusRing } from "@/src/presentation/design-system/components/shared/focusRing";

import { ExpenseRowActions } from "./ExpenseRowActions";
import { ExpenseStatusBadge } from "./ExpenseStatusBadge";

/**
 * The list's columns on a wide frame — the expense, its date, the account it's
 * booked to, its status, the total and the "⋯" — shared with the heading row so
 * the two line up.
 */
export const EXPENSE_ROW_GRID = "@[60rem]/expenses:grid-cols-[minmax(0,1fr)_6rem_10rem_6rem_9rem_2.5rem]";

type ExpenseRowProps = {
  expense: Expense;
  /** The account's name in the reader's language, or its code when it's gone. */
  accountName: string;
  canWrite: boolean;
};

/**
 * One expense: what it was, its number and supplier, then the date, the account
 * it's booked to, its status and the total — struck through once it's void. A
 * row on a wide frame; on a narrow one the figures wrap under the name, each
 * labelled, and the "⋯" stays beside it.
 */
export async function ExpenseRow({ expense, accountName, canWrite }: ExpenseRowProps) {
  const t = await getTranslations("dashExpenses");
  const locale = await getLocale();

  const isVoid = expense.status === "void";
  const sub = [`EX-${expense.number}`, expense.supplierName].filter(Boolean).join(" · ");
  const figure = "flex min-w-0 flex-col gap-0.5";
  const inlineLabel = "text-body-small text-muted-foreground sm:text-body-caption @[60rem]/expenses:hidden";

  return (
    <article
      aria-label={t("rowLabel", { number: expense.number, description: expense.description })}
      className={cn("grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-3 px-5 py-3", EXPENSE_ROW_GRID)}
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <Link
          href={`/dashboard/expenses/${expense.id}`}
          dir="auto"
          className={cn(
            "w-fit max-w-full text-body-strong [overflow-wrap:anywhere] text-foreground transition-colors hover:text-primary sm:text-body-small-strong sm:leading-5",
            focusRing,
          )}
        >
          {expense.description}
        </Link>
        <span className="text-body-small text-muted-foreground tabular-nums sm:text-body-caption sm:leading-4">
          {sub}
        </span>
      </div>

      {/* The figures: their own wrapped line under the name on a narrow frame,
          columns of the row's grid on a wide one. */}
      <div className="order-1 col-span-full flex flex-wrap gap-x-8 gap-y-2 text-body-default sm:text-body-small @[60rem]/expenses:contents">
        <div className={figure}>
          <span className={inlineLabel}>{t("col.date")}</span>
          <span className="whitespace-nowrap text-foreground/80 tabular-nums">
            {formatCafeDayShort(expense.date, locale)}
          </span>
        </div>
        <div className={figure}>
          <span className={inlineLabel}>{t("col.account")}</span>
          <span className="text-foreground/80">{accountName}</span>
        </div>
        <div className={figure}>
          <span className={inlineLabel}>{t("col.status")}</span>
          <span className="flex">
            <ExpenseStatusBadge status={expense.status} />
          </span>
        </div>
        <div className={cn(figure, "@[60rem]/expenses:items-end @[60rem]/expenses:text-end")}>
          <span className={inlineLabel}>{t("col.total")}</span>
          <span
            className={cn(
              "font-semibold whitespace-nowrap tabular-nums",
              isVoid ? "text-muted-foreground line-through" : "text-foreground",
            )}
          >
            {formatNumber(expense.amount, locale)}
          </span>
        </div>
      </div>

      <div className="flex justify-end @[60rem]/expenses:order-1">
        {canWrite ? (
          <ExpenseRowActions
            expense={{
              id: expense.id,
              number: expense.number,
              date: expense.date,
              description: expense.description,
              amount: expense.amount,
              status: expense.status,
            }}
          />
        ) : null}
      </div>
    </article>
  );
}
