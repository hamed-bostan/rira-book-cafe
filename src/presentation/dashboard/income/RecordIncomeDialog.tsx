"use client";

import { useLocale, useTranslations } from "next-intl";
import * as React from "react";

import { moneyField, optionalMoneyField } from "@/src/contracts/money-fields";
import { isCafeDay } from "@/src/domain/entities/CafeTime";
import { INCOME_METHODS, type IncomeMethod, type IncomeSourceType } from "@/src/domain/entities/Income";
import { vatIncluded, type Account } from "@/src/domain/entities/Ledger";
import { useRouter } from "@/src/i18n/navigation";
import { formatMoney } from "@/src/lib/formatMoney";
import { formatNumber } from "@/src/lib/formatNumber";
import { accountLabel } from "@/src/presentation/dashboard/accounting/accounting-format";
import { expenseApiErrorMessage } from "@/src/presentation/dashboard/expenses/expenseApiErrorMessage";
import { normalizeAmount } from "@/src/presentation/dashboard/expenses/expenseFormat";
import { Input } from "@/src/presentation/design-system/components/form/Input/Input";
import { Select } from "@/src/presentation/design-system/components/form/Select/Select";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { DashboardDialog } from "../DashboardDialog";
import { DashboardField } from "../DashboardField";
import { FIELD_GRID } from "../fieldStyles";

import { incomesApi } from "./income-api";

/** A payment for something on the books: the account and description are settled, the amount suggested. */
export type IncomePreset = {
  accountCode: string;
  description: string;
  amount?: number;
  payerName?: string;
  sourceType: IncomeSourceType;
  sourceId: string;
};

type RecordIncomeDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The revenue accounts to choose from, when nothing's preset. */
  accounts: readonly Account[];
  /** Today on the cafe calendar — the default date, and the latest allowed. */
  today: string;
  /** VAT included in prices, in basis points: what the VAT field starts from. */
  vatRateBps: number;
  preset?: IncomePreset;
};

/**
 * Record money that came in outside an order: when, for what, how much, and how it
 * was received. The VAT inside the total fills itself in at the cafe's rate until
 * it's typed over, for income that carries less or none.
 */
export function RecordIncomeDialog({
  open,
  onOpenChange,
  accounts,
  today,
  vatRateBps,
  preset,
}: RecordIncomeDialogProps) {
  const t = useTranslations("dashIncome");
  const tApiErrors = useTranslations("apiErrors");
  const tFormErrors = useTranslations("formErrors");
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();

  const [date, setDate] = React.useState(today);
  const [description, setDescription] = React.useState(preset?.description ?? "");
  const [accountCode, setAccountCode] = React.useState(preset?.accountCode ?? "");
  const [payerName, setPayerName] = React.useState(preset?.payerName ?? "");
  const [amount, setAmount] = React.useState(preset?.amount ? String(preset.amount) : "");
  /** What's typed over the suggested VAT; `null` while the suggestion stands. */
  const [vatTyped, setVatTyped] = React.useState<string | null>(null);
  const [method, setMethod] = React.useState<IncomeMethod>("cash");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const total = moneyField.safeParse(normalizeAmount(amount));
  const suggestedVat = total.success ? String(vatIncluded(total.data, vatRateBps)) : "";
  const vatAmount = vatTyped ?? suggestedVat;
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
    setError(null);
    startTransition(async () => {
      try {
        const income = await incomesApi.create({
          date,
          accountCode,
          description,
          amount: normalizeAmount(amount),
          vatAmount: normalizeAmount(vatAmount),
          method,
          payerName,
          sourceType: preset?.sourceType,
          sourceId: preset?.sourceId,
        });
        toast({ tone: "success", title: t("form.saved", { number: income.number }) });
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
      title={t("form.title")}
      subtitle={t("form.subtitle")}
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
        <DashboardField label={t("form.payerLabel")}>
          <Input
            size="control-md"
            value={payerName}
            onChange={(event) => setPayerName(event.target.value)}
            autoComplete="off"
            dir="auto"
          />
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

      {preset ? null : (
        <DashboardField label={t("form.accountLabel")}>
          <Select size="control-md" value={accountCode} onChange={(event) => setAccountCode(event.target.value)}>
            <option value="">{t("form.accountPlaceholder")}</option>
            {accounts.map((account) => (
              <option key={account.code} value={account.code}>
                {accountLabel(account, locale)}
              </option>
            ))}
          </Select>
        </DashboardField>
      )}

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
            onChange={(event) => setVatTyped(event.target.value)}
            autoComplete="off"
            inputMode="numeric"
            placeholder="0"
            dir="ltr"
          />
        </DashboardField>
      </div>

      <DashboardField label={t("form.methodLabel")}>
        <Select size="control-md" value={method} onChange={(event) => setMethod(event.target.value as IncomeMethod)}>
          {INCOME_METHODS.map((option) => (
            <option key={option} value={option}>
              {t(`method.${option}`)}
            </option>
          ))}
        </Select>
      </DashboardField>
    </DashboardDialog>
  );
}
