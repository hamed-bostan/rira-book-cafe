"use client";

import { MoreHorizontal } from "lucide-react";
import { useTranslations } from "next-intl";

import type { ExpenseStatus } from "@/src/domain/entities/Expense";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuIconTrigger,
  DropdownMenuItem,
} from "@/src/presentation/design-system/components/DropdownMenu/DropdownMenu";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";

import { useExpenseDialogs } from "./ExpenseDialogsProvider";

import type { PayableExpense } from "./PayExpenseDialog";

type ExpenseRowActionsProps = {
  expense: PayableExpense & { status: ExpenseStatus };
};

/**
 * An expense's "⋯": pay it while it's owed, and void it until it's void — each
 * opening its dialog. A void expense has nothing left to do, so it has no menu.
 */
export function ExpenseRowActions({ expense }: ExpenseRowActionsProps) {
  const t = useTranslations("dashExpenses");
  const { openPay, openVoid } = useExpenseDialogs();

  if (expense.status === "void") return null;

  return (
    <DropdownMenu>
      <DropdownMenuIconTrigger appearance="secondary" aria-label={t("moreActionsAria", { number: expense.number })}>
        <Icon icon={MoreHorizontal} size="sm" className="sm:size-4" />
      </DropdownMenuIconTrigger>
      <DropdownMenuContent align="end">
        {expense.status === "unpaid" ? (
          <DropdownMenuItem onSelect={() => openPay(expense)}>{t("detail.pay")}</DropdownMenuItem>
        ) : null}
        <DropdownMenuItem destructive onSelect={() => openVoid(expense)}>
          {t("detail.void")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
