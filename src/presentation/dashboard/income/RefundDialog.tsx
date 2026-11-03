"use client";

import { useLocale, useTranslations } from "next-intl";
import * as React from "react";

import { moneyField } from "@/src/contracts/money-fields";
import { INCOME_METHODS, type IncomeMethod } from "@/src/domain/entities/Income";
import { MAX_REFUND_REASON_LENGTH } from "@/src/domain/entities/IncomeRefund";
import { useRouter } from "@/src/i18n/navigation";
import { formatMoney } from "@/src/lib/formatMoney";
import { expenseApiErrorMessage } from "@/src/presentation/dashboard/expenses/expenseApiErrorMessage";
import { normalizeAmount } from "@/src/presentation/dashboard/expenses/expenseFormat";
import { Input } from "@/src/presentation/design-system/components/form/Input/Input";
import { Select } from "@/src/presentation/design-system/components/form/Select/Select";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { DashboardDialog } from "../DashboardDialog";
import { DashboardField } from "../DashboardField";
import { FIELD_GRID } from "../fieldStyles";

import { incomeRefundsApi, type RefundTarget } from "./income-refund-api";

/** Who paid for what, and how much of it is still theirs to have back. */
export type RefundableBooking = {
  target: RefundTarget;
  guestName: string;
  paid: number;
  refunded: number;
  /** What the amount starts at — what's due back; blank when nothing is, so staff type it. */
  suggested?: number;
};

type RefundDialogProps = RefundableBooking & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Hand money back from a suite stay or an event sign-up: how much (up to what's
 * been paid and not yet refunded), how it goes back, and why. The server books it
 * against the revenue and VAT the payments went to, and tells the guest.
 */
export function RefundDialog({ open, onOpenChange, target, guestName, paid, refunded, suggested }: RefundDialogProps) {
  const t = useTranslations("dashIncome");
  const tApiErrors = useTranslations("apiErrors");
  const tFormErrors = useTranslations("formErrors");
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();

  const left = Math.max(paid - refunded, 0);
  const [amount, setAmount] = React.useState(suggested ? String(Math.min(suggested, left)) : "");
  const [method, setMethod] = React.useState<IncomeMethod>("cash");
  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const parsed = moneyField.safeParse(normalizeAmount(amount));
  const fieldError =
    amount.trim() !== "" && !parsed.success
      ? tFormErrors("amountInvalid")
      : parsed.success && parsed.data > left
        ? tFormErrors("refundOverPaid")
        : undefined;
  const ready = parsed.success && !fieldError;

  function submit(): void {
    setError(null);
    startTransition(async () => {
      try {
        await incomeRefundsApi.create(target, { amount: normalizeAmount(amount), method, reason });
        toast({
          tone: "success",
          title: t("refund.done", { amount: formatMoney(parsed.data ?? 0, locale), name: guestName }),
        });
        onOpenChange(false);
        router.refresh();
      } catch (err) {
        setError(expenseApiErrorMessage(err, tFormErrors, tApiErrors, t("refund.error")));
      }
    });
  }

  return (
    <DashboardDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("refund.title", { name: guestName })}
      subtitle={t("refund.subtitle", {
        paid: formatMoney(paid, locale),
        refunded: refunded > 0 ? formatMoney(refunded, locale) : "none",
        left: formatMoney(left, locale),
      })}
      submitLabel={t("refund.save")}
      blocked={!ready}
      pending={pending}
      onSubmit={submit}
      preview={ready ? t("refund.preview", { amount: formatMoney(parsed.data, locale), name: guestName }) : undefined}
      error={fieldError ?? error}
      danger
    >
      <div className={FIELD_GRID}>
        <DashboardField label={t("refund.amountLabel")}>
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
        <DashboardField label={t("refund.methodLabel")}>
          <Select size="control-md" value={method} onChange={(event) => setMethod(event.target.value as IncomeMethod)}>
            {INCOME_METHODS.map((option) => (
              <option key={option} value={option}>
                {t(`method.${option}`)}
              </option>
            ))}
          </Select>
        </DashboardField>
      </div>
      <DashboardField label={t("refund.reasonLabel")}>
        <Input
          size="control-md"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          maxLength={MAX_REFUND_REASON_LENGTH}
          autoComplete="off"
          dir="auto"
          placeholder={t("refund.reasonPlaceholder")}
        />
      </DashboardField>
    </DashboardDialog>
  );
}
