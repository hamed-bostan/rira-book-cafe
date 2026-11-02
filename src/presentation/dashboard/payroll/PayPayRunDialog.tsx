"use client";

import { useLocale, useTranslations } from "next-intl";
import * as React from "react";

import { optionalMoneyField } from "@/src/contracts/money-fields";
import { isCafeDay } from "@/src/domain/entities/CafeTime";
import { PAYMENT_SOURCES, type PaymentSource } from "@/src/domain/entities/Expense";
import { useRouter } from "@/src/i18n/navigation";
import { formatMoney } from "@/src/lib/formatMoney";
import { Input } from "@/src/presentation/design-system/components/form/Input/Input";
import { Select } from "@/src/presentation/design-system/components/form/Select/Select";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { DashboardDialog } from "../DashboardDialog";
import { DashboardField } from "../DashboardField";
import { expenseApiErrorMessage } from "../expenses/expenseApiErrorMessage";
import { normalizeAmount } from "../expenses/expenseFormat";

import { payRunsApi } from "./payroll-api";

type PayPayRunDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  id: string;
  month: string;
  date: string;
  owed: number;
  today: string;
};

/**
 * Pay out a run, or part of it, from the cash register or the bank. A blank amount
 * pays all that's left; a part keeps the run owed for the rest.
 */
export function PayPayRunDialog({ open, onOpenChange, id, month, date, owed, today }: PayPayRunDialogProps) {
  const t = useTranslations("dashPayroll");
  const tApiErrors = useTranslations("apiErrors");
  const tFormErrors = useTranslations("formErrors");
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();

  const [source, setSource] = React.useState<PaymentSource>("bank");
  const [paidOn, setPaidOn] = React.useState(today);
  const [amount, setAmount] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const typed = normalizeAmount(amount);
  const part = optionalMoneyField.safeParse(typed);
  const fieldError = !part.success
    ? tFormErrors("amountInvalid")
    : part.data > owed
      ? tFormErrors("paymentOverOwed")
      : undefined;
  const ready = !fieldError && isCafeDay(paidOn) && paidOn >= date && paidOn <= today;

  function submit(): void {
    setError(null);
    startTransition(async () => {
      try {
        await payRunsApi.pay(id, { source, paidOn, amount: typed });
        toast({ tone: "success", title: t("detail.paid", { month }) });
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
      title={t("detail.payTitle", { month })}
      subtitle={t("detail.paySub", { amount: formatMoney(owed, locale) })}
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
      <div className="grid grid-cols-2 gap-4">
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
            min={date}
            max={today}
            onChange={(event) => setPaidOn(event.target.value)}
            dir="ltr"
          />
        </DashboardField>
      </div>
    </DashboardDialog>
  );
}
