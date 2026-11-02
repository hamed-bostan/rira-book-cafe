"use client";

import { useLocale, useTranslations } from "next-intl";
import * as React from "react";

import { optionalMoneyField } from "@/src/contracts/money-fields";
import { isCafeDay } from "@/src/domain/entities/CafeTime";
import { PAYMENT_SOURCES, type Expense, type PaymentSource } from "@/src/domain/entities/Expense";
import { useRouter } from "@/src/i18n/navigation";
import { formatMoney } from "@/src/lib/formatMoney";
import { Input } from "@/src/presentation/design-system/components/form/Input/Input";
import { Select } from "@/src/presentation/design-system/components/form/Select/Select";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { DashboardDialog } from "../DashboardDialog";
import { DashboardField } from "../DashboardField";
import { FIELD_GRID } from "../fieldStyles";

import { expensesApi } from "./expense-api";
import { expenseApiErrorMessage } from "./expenseApiErrorMessage";
import { normalizeAmount } from "./expenseFormat";

export type PayableExpense = Pick<Expense, "id" | "number" | "date" | "description" | "amount" | "paidAmount">;

type PayExpenseDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expense: PayableExpense;
  /** Today on the cafe calendar — the default payment day, and the latest allowed. */
  today: string;
};

/**
 * Pay an owed bill, or part of it, from the cash register or the bank, on a day
 * between the bill's and today. A blank amount pays all that's left; a part keeps the
 * bill owed for the rest.
 */
export function PayExpenseDialog({ open, onOpenChange, expense, today }: PayExpenseDialogProps) {
  const t = useTranslations("dashExpenses");
  const tApiErrors = useTranslations("apiErrors");
  const tFormErrors = useTranslations("formErrors");
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();

  const [source, setSource] = React.useState<PaymentSource>("cash");
  const [paidOn, setPaidOn] = React.useState(today);
  const [amount, setAmount] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const owed = expense.amount - expense.paidAmount;
  const typed = normalizeAmount(amount);
  const part = optionalMoneyField.safeParse(typed);
  const fieldError = !part.success
    ? tFormErrors("amountInvalid")
    : part.data > owed
      ? tFormErrors("paymentOverOwed")
      : undefined;
  const ready = !fieldError && isCafeDay(paidOn) && paidOn >= expense.date && paidOn <= today;

  function submit(): void {
    setError(null);
    startTransition(async () => {
      try {
        await expensesApi.pay(expense.id, { source, paidOn, amount: typed });
        toast({ tone: "success", title: t("detail.paid", { number: expense.number }) });
        onOpenChange(false);
        router.refresh();
      } catch (err) {
        setError(expenseApiErrorMessage(err, tFormErrors, tApiErrors, t("detail.payError")));
      }
    });
  }

  return (
    <DashboardDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("detail.payTitle", { number: expense.number })}
      subtitle={t("detail.paySub", { description: expense.description, amount: formatMoney(owed, locale) })}
      submitLabel={t("detail.payConfirm")}
      blocked={!ready}
      pending={pending}
      onSubmit={submit}
      error={fieldError ?? error}
    >
      <DashboardField label={t("detail.payAmount")} hint={t("detail.payAmountHint")}>
        <Input
          size="control-md"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          autoComplete="off"
          inputMode="numeric"
          placeholder={String(owed)}
          dir="ltr"
        />
      </DashboardField>
      <div className={FIELD_GRID}>
        <DashboardField label={t("detail.paySource")}>
          <Select size="control-md" value={source} onChange={(event) => setSource(event.target.value as PaymentSource)}>
            {PAYMENT_SOURCES.map((option) => (
              <option key={option} value={option}>
                {t(`detail.from.${option}`)}
              </option>
            ))}
          </Select>
        </DashboardField>
        <DashboardField label={t("detail.paidOn")}>
          <Input
            size="control-md"
            type="date"
            value={paidOn}
            min={expense.date}
            max={today}
            onChange={(event) => setPaidOn(event.target.value)}
            dir="ltr"
          />
        </DashboardField>
      </div>
    </DashboardDialog>
  );
}
