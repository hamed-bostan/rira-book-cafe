"use client";

import { useLocale, useTranslations } from "next-intl";
import * as React from "react";

import { EXPENSE_PAYMENT_CHOICES, type ExpenseFormInput } from "@/src/contracts/expense-schema";
import { moneyField, optionalMoneyField } from "@/src/contracts/money-fields";
import { isCafeDay } from "@/src/domain/entities/CafeTime";
import type { Supplier } from "@/src/domain/entities/Expense";
import type { Account } from "@/src/domain/entities/Ledger";
import type { DueBill } from "@/src/domain/entities/RecurringBill";
import { useRouter } from "@/src/i18n/navigation";
import { formatMoney } from "@/src/lib/formatMoney";
import { formatNumber } from "@/src/lib/formatNumber";
import { accountLabel } from "@/src/presentation/dashboard/accounting/accounting-format";
import { FIELD_GRID, FIELD_LABEL } from "@/src/presentation/dashboard/fieldStyles";
import { Input } from "@/src/presentation/design-system/components/form/Input/Input";
import { Select } from "@/src/presentation/design-system/components/form/Select/Select";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { DashboardDialog } from "../DashboardDialog";
import { DashboardField } from "../DashboardField";

import { expensesApi, recurringBillsApi } from "./expense-api";
import { expenseApiErrorMessage } from "./expenseApiErrorMessage";
import { formatPersianMonth, normalizeAmount } from "./expenseFormat";
import { ExpenseReceiptUpload } from "./ExpenseReceiptUpload";

type RecordExpenseDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Accounts an expense can be booked to (expense accounts, equipment). */
  accounts: readonly Account[];
  /** Suppliers still bought from. */
  suppliers: readonly Supplier[];
  /** Today on the cafe calendar — the default date, and the latest allowed. */
  today: string;
  /** The month of a recurring bill this records: the form starts from its usual figures. */
  due?: DueBill;
};

type Payment = (typeof EXPENSE_PAYMENT_CHOICES)[number];

/**
 * Record a bill or purchase: when, from whom, what for, booked to which account,
 * the total with the invoice's VAT, whether it's owed or paid now, and a photo of
 * the receipt if there is one. The net + VAT split shows as the amounts are typed,
 * and saving waits until it adds up and any photo has finished uploading. A month of
 * a recurring bill opens here too, filled in, so a person checks it before it's booked.
 */
export function RecordExpenseDialog({ open, onOpenChange, accounts, suppliers, today, due }: RecordExpenseDialogProps) {
  const t = useTranslations("dashExpenses");
  const tApiErrors = useTranslations("apiErrors");
  const tFormErrors = useTranslations("formErrors");
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();

  const bill = due?.bill;
  const month = due ? formatPersianMonth(due.dueOn, locale) : undefined;
  const [date, setDate] = React.useState(due?.dueOn ?? today);
  // A supplier or account switched off since the bill was set up has to be chosen again.
  const [supplierId, setSupplierId] = React.useState(
    suppliers.some((supplier) => supplier.id === bill?.supplierId) ? (bill?.supplierId ?? "") : "",
  );
  const [description, setDescription] = React.useState(bill ? `${bill.description} · ${month}` : "");
  const [accountCode, setAccountCode] = React.useState(
    accounts.some((account) => account.code === bill?.accountCode) ? (bill?.accountCode ?? "") : "",
  );
  const [amount, setAmount] = React.useState(bill ? String(bill.amount) : "");
  const [vatAmount, setVatAmount] = React.useState(bill?.vatAmount ? String(bill.vatAmount) : "");
  const [payment, setPayment] = React.useState<Payment>("unpaid");
  const [receiptUrl, setReceiptUrl] = React.useState("");
  const [uploading, setUploading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const receiptId = React.useId();

  const total = moneyField.safeParse(normalizeAmount(amount));
  const vat = optionalMoneyField.safeParse(normalizeAmount(vatAmount));
  const fieldError =
    (amount.trim() !== "" && !total.success) || !vat.success
      ? tFormErrors("amountInvalid")
      : total.success && vat.success && vat.data >= total.data
        ? t("form.vatTooHigh")
        : undefined;
  const ready =
    !fieldError &&
    !uploading &&
    total.success &&
    isCafeDay(date) &&
    date <= today &&
    description.trim() !== "" &&
    accountCode !== "";

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
      receiptUrl,
    };
    setError(null);
    startTransition(async () => {
      try {
        const expense = due
          ? await recurringBillsApi.record(due.bill.id, due.period, values)
          : await expensesApi.create(values);
        toast({ tone: "success", title: t("form.saved", { number: expense.number }) });
        onOpenChange(false);
        router.refresh();
      } catch (err) {
        setError(expenseApiErrorMessage(err, tFormErrors, tApiErrors, t("form.error")));
      }
    });
  }

  return (
    <DashboardDialog
      open={open}
      onOpenChange={onOpenChange}
      title={bill ? t("recurring.recordTitle", { name: bill.description }) : t("form.title")}
      subtitle={month ? t("recurring.recordSubtitle", { month }) : t("form.subtitle")}
      submitLabel={t("form.save")}
      blocked={!ready}
      pending={pending}
      onSubmit={submit}
      preview={preview}
      error={fieldError ?? error}
    >
      <div className={FIELD_GRID}>
        <DashboardField label={t("form.dateLabel")}>
          <Input
            size="control-md"
            type="date"
            value={date}
            max={today}
            onChange={(event) => setDate(event.target.value)}
            dir="ltr"
          />
        </DashboardField>
        <DashboardField label={t("form.supplierLabel")}>
          <Select size="control-md" value={supplierId} onChange={(event) => setSupplierId(event.target.value)}>
            <option value="">{t("form.noSupplier")}</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name}
              </option>
            ))}
          </Select>
        </DashboardField>
      </div>

      <DashboardField label={t("form.descriptionLabel")}>
        <Input
          size="control-md"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          autoComplete="off"
          dir="auto"
          placeholder={t("form.descriptionPlaceholder")}
        />
      </DashboardField>

      <DashboardField label={t("form.accountLabel")} hint={t("form.accountHint")}>
        <Select size="control-md" value={accountCode} onChange={(event) => setAccountCode(event.target.value)}>
          <option value="">{t("form.accountPlaceholder")}</option>
          {accounts.map((account) => (
            <option key={account.code} value={account.code}>
              {accountLabel(account, locale)}
            </option>
          ))}
        </Select>
      </DashboardField>

      <div className={FIELD_GRID}>
        <DashboardField label={t("form.amountLabel")}>
          <Input
            size="control-md"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            autoComplete="off"
            inputMode="numeric"
            placeholder="0"
            dir="ltr"
          />
        </DashboardField>
        <DashboardField label={t("form.vatLabel")} hint={t("form.vatHint")}>
          <Input
            size="control-md"
            value={vatAmount}
            onChange={(event) => setVatAmount(event.target.value)}
            autoComplete="off"
            inputMode="numeric"
            placeholder="0"
            dir="ltr"
          />
        </DashboardField>
      </div>

      <DashboardField label={t("form.paymentLabel")}>
        <Select size="control-md" value={payment} onChange={(event) => setPayment(event.target.value as Payment)}>
          {EXPENSE_PAYMENT_CHOICES.map((choice) => (
            <option key={choice} value={choice}>
              {t(`form.payment.${choice}`)}
            </option>
          ))}
        </Select>
      </DashboardField>

      <div className="flex min-w-0 flex-col gap-1.5">
        <label htmlFor={receiptId} className={FIELD_LABEL}>
          {t("receipt.heading")}
        </label>
        <ExpenseReceiptUpload
          id={receiptId}
          value={receiptUrl}
          onChange={setReceiptUrl}
          onUploadingChange={setUploading}
        />
      </div>
    </DashboardDialog>
  );
}
