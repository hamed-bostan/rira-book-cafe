"use client";

import { useLocale, useTranslations } from "next-intl";
import * as React from "react";

import { EXPENSE_PAYMENT_CHOICES, type ExpenseFormInput } from "@/src/contracts/expense-schema";
import { moneyField, optionalMoneyField } from "@/src/contracts/money-fields";
import { isCafeDay } from "@/src/domain/entities/CafeTime";
import type { Supplier } from "@/src/domain/entities/Expense";
import type { Account } from "@/src/domain/entities/Ledger";
import { useRouter } from "@/src/i18n/navigation";
import { formatMoney } from "@/src/lib/formatMoney";
import { formatNumber } from "@/src/lib/formatNumber";
import { accountLabel } from "@/src/presentation/dashboard/accounting/accounting-format";
import { Input } from "@/src/presentation/design-system/components/form/Input/Input";
import { Select } from "@/src/presentation/design-system/components/form/Select/Select";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { expensesApi } from "./expense-api";
import { expenseApiErrorMessage } from "./expenseApiErrorMessage";
import { ExpenseDialog } from "./ExpenseDialog";
import { ExpenseField } from "./ExpenseField";
import { normalizeAmount } from "./expenseFormat";

type RecordExpenseDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Accounts an expense can be booked to (expense accounts, equipment). */
  accounts: readonly Account[];
  /** Suppliers still bought from. */
  suppliers: readonly Supplier[];
  /** Today on the cafe calendar — the default date, and the latest allowed. */
  today: string;
};

type Payment = (typeof EXPENSE_PAYMENT_CHOICES)[number];

/**
 * Record a bill or purchase: when, from whom, what for, booked to which account,
 * the total with the invoice's VAT, and whether it's owed or paid now. The net +
 * VAT split shows as the amounts are typed, and saving waits until it adds up.
 */
export function RecordExpenseDialog({ open, onOpenChange, accounts, suppliers, today }: RecordExpenseDialogProps) {
  const t = useTranslations("dashExpenses");
  const tApiErrors = useTranslations("apiErrors");
  const tFormErrors = useTranslations("formErrors");
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();

  const [date, setDate] = React.useState(today);
  const [supplierId, setSupplierId] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [accountCode, setAccountCode] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [vatAmount, setVatAmount] = React.useState("");
  const [payment, setPayment] = React.useState<Payment>("unpaid");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const total = moneyField.safeParse(normalizeAmount(amount));
  const vat = optionalMoneyField.safeParse(normalizeAmount(vatAmount));
  const fieldError =
    (amount.trim() !== "" && !total.success) || !vat.success
      ? tFormErrors("amountInvalid")
      : total.success && vat.success && vat.data >= total.data
        ? t("form.vatTooHigh")
        : undefined;
  const ready =
    !fieldError && total.success && isCafeDay(date) && date <= today && description.trim() !== "" && accountCode !== "";

  const preview =
    total.success && vat.success && !fieldError
      ? t("form.breakdown", {
          net: formatNumber(total.data - vat.data, locale),
          vat: formatNumber(vat.data, locale),
          total: formatMoney(total.data, locale),
        })
      : undefined;

  function submit(): void {
    const values: ExpenseFormInput = {
      date,
      supplierId,
      accountCode,
      description,
      amount: normalizeAmount(amount),
      vatAmount: normalizeAmount(vatAmount),
      payment,
    };
    setError(null);
    startTransition(async () => {
      try {
        const expense = await expensesApi.create(values);
        toast({ tone: "success", title: t("form.saved", { number: expense.number }) });
        onOpenChange(false);
        router.refresh();
      } catch (err) {
        setError(expenseApiErrorMessage(err, tFormErrors, tApiErrors, t("form.error")));
      }
    });
  }

  return (
    <ExpenseDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("form.title")}
      subtitle={t("form.subtitle")}
      submitLabel={t("form.save")}
      blocked={!ready}
      pending={pending}
      onSubmit={submit}
      preview={preview}
      error={fieldError ?? error}
    >
      <div className="grid grid-cols-2 gap-4">
        <ExpenseField label={t("form.dateLabel")}>
          <Input
            size="control-md"
            type="date"
            value={date}
            max={today}
            onChange={(event) => setDate(event.target.value)}
            dir="ltr"
          />
        </ExpenseField>
        <ExpenseField label={t("form.supplierLabel")}>
          <Select size="control-md" value={supplierId} onChange={(event) => setSupplierId(event.target.value)}>
            <option value="">{t("form.noSupplier")}</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name}
              </option>
            ))}
          </Select>
        </ExpenseField>
      </div>

      <ExpenseField label={t("form.descriptionLabel")}>
        <Input
          size="control-md"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          autoComplete="off"
          dir="auto"
          placeholder={t("form.descriptionPlaceholder")}
        />
      </ExpenseField>

      <ExpenseField label={t("form.accountLabel")} hint={t("form.accountHint")}>
        <Select size="control-md" value={accountCode} onChange={(event) => setAccountCode(event.target.value)}>
          <option value="">{t("form.accountPlaceholder")}</option>
          {accounts.map((account) => (
            <option key={account.code} value={account.code}>
              {accountLabel(account, locale)}
            </option>
          ))}
        </Select>
      </ExpenseField>

      <div className="grid grid-cols-2 gap-4">
        <ExpenseField label={t("form.amountLabel")}>
          <Input
            size="control-md"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            autoComplete="off"
            inputMode="numeric"
            placeholder="0"
            dir="ltr"
          />
        </ExpenseField>
        <ExpenseField label={t("form.vatLabel")} hint={t("form.vatHint")}>
          <Input
            size="control-md"
            value={vatAmount}
            onChange={(event) => setVatAmount(event.target.value)}
            autoComplete="off"
            inputMode="numeric"
            placeholder="0"
            dir="ltr"
          />
        </ExpenseField>
      </div>

      <ExpenseField label={t("form.paymentLabel")}>
        <Select size="control-md" value={payment} onChange={(event) => setPayment(event.target.value as Payment)}>
          {EXPENSE_PAYMENT_CHOICES.map((choice) => (
            <option key={choice} value={choice}>
              {t(`form.payment.${choice}`)}
            </option>
          ))}
        </Select>
      </ExpenseField>
    </ExpenseDialog>
  );
}
