"use client";

import { useLocale, useTranslations } from "next-intl";
import * as React from "react";

import type { DueBill } from "@/src/domain/entities/RecurringBill";
import { useRouter } from "@/src/i18n/navigation";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { DashboardDialog } from "../DashboardDialog";

import { recurringBillsApi } from "./expense-api";
import { expenseApiErrorMessage } from "./expenseApiErrorMessage";
import { formatPersianMonth } from "./expenseFormat";

type SkipBillDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  due: DueBill;
};

/** Asks first: a skipped month stops being asked about, so a slip here would lose the bill quietly. */
export function SkipBillDialog({ open, onOpenChange, due }: SkipBillDialogProps) {
  const t = useTranslations("dashExpenses.recurring");
  const tApiErrors = useTranslations("apiErrors");
  const tFormErrors = useTranslations("formErrors");
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const name = due.bill.description;
  const month = formatPersianMonth(due.dueOn, locale);

  function submit(): void {
    setError(null);
    startTransition(async () => {
      try {
        await recurringBillsApi.skip(due.bill.id, due.period);
        toast({ tone: "success", title: t("skipped", { name, month }) });
        onOpenChange(false);
        router.refresh();
      } catch (err) {
        setError(expenseApiErrorMessage(err, tFormErrors, tApiErrors, t("skipError")));
      }
    });
  }

  return (
    <DashboardDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("skipTitle", { name, month })}
      subtitle={t("skipMessage")}
      submitLabel={t("skipConfirm")}
      pending={pending}
      onSubmit={submit}
      error={error}
    />
  );
}
