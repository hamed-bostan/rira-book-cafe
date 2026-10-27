"use client";

import { useLocale, useTranslations } from "next-intl";
import * as React from "react";

import { isCafeDay } from "@/src/domain/entities/CafeTime";
import { PAYMENT_SOURCES, type Expense, type PaymentSource } from "@/src/domain/entities/Expense";
import { useRouter } from "@/src/i18n/navigation";
import { formatMoney } from "@/src/lib/formatMoney";
import { Input } from "@/src/presentation/design-system/components/form/Input/Input";
import { Select } from "@/src/presentation/design-system/components/form/Select/Select";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { expensesApi } from "./expense-api";
import { expenseApiErrorMessage } from "./expenseApiErrorMessage";
import { ExpenseDialog } from "./ExpenseDialog";
import { ExpenseField } from "./ExpenseField";

export type PayableExpense = Pick<Expense, "id" | "number" | "date" | "description" | "amount">;

type PayExpenseDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expense: PayableExpense;
  /** Today on the cafe calendar — the default payment day, and the latest allowed. */
  today: string;
};

/** Pay an owed bill from the cash register or the bank, on a day between the bill's and today. */
export function PayExpenseDialog({ open, onOpenChange, expense, today }: PayExpenseDialogProps) {
  const t = useTranslations("dashExpenses");
  const tApiErrors = useTranslations("apiErrors");
  const tFormErrors = useTranslations("formErrors");
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();

  const [source, setSource] = React.useState<PaymentSource>("cash");
  const [paidOn, setPaidOn] = React.useState(today);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const ready = isCafeDay(paidOn) && paidOn >= expense.date && paidOn <= today;

  function submit(): void {
    setError(null);
    startTransition(async () => {
      try {
        await expensesApi.pay(expense.id, { source, paidOn });
        toast({ tone: "success", title: t("detail.paid", { number: expense.number }) });
        onOpenChange(false);
        router.refresh();
      } catch (err) {
        setError(expenseApiErrorMessage(err, tFormErrors, tApiErrors, t("detail.payError")));
      }
    });
  }

  return (
    <ExpenseDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("detail.payTitle", { number: expense.number })}
      subtitle={t("detail.paySub", { description: expense.description, amount: formatMoney(expense.amount, locale) })}
      submitLabel={t("detail.payConfirm")}
      blocked={!ready}
      pending={pending}
      onSubmit={submit}
      error={error}
    >
      <div className="grid grid-cols-2 gap-4">
        <ExpenseField label={t("detail.paySource")}>
          <Select size="control-md" value={source} onChange={(event) => setSource(event.target.value as PaymentSource)}>
            {PAYMENT_SOURCES.map((option) => (
              <option key={option} value={option}>
                {t(`detail.from.${option}`)}
              </option>
            ))}
          </Select>
        </ExpenseField>
        <ExpenseField label={t("detail.paidOn")}>
          <Input
            size="control-md"
            type="date"
            value={paidOn}
            min={expense.date}
            max={today}
            onChange={(event) => setPaidOn(event.target.value)}
            dir="ltr"
          />
        </ExpenseField>
      </div>
    </ExpenseDialog>
  );
}
