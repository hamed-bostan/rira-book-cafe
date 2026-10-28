"use client";

import { useTranslations } from "next-intl";
import * as React from "react";

import type { Expense } from "@/src/domain/entities/Expense";
import { useRouter } from "@/src/i18n/navigation";
import { Input } from "@/src/presentation/design-system/components/form/Input/Input";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { DashboardDialog } from "../DashboardDialog";
import { DashboardField } from "../DashboardField";

import { expensesApi } from "./expense-api";
import { expenseApiErrorMessage } from "./expenseApiErrorMessage";

/** The longest reason the reversing entries carry. */
const MAX_VOID_REASON_LENGTH = 200;

type VoidExpenseDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expense: Pick<Expense, "id" | "number">;
};

/**
 * Void an expense entered by mistake: everything it posted is reversed today and
 * the record stays, marked void. There's no undo — the reversal is final — so it
 * asks first, with room for a reason.
 */
export function VoidExpenseDialog({ open, onOpenChange, expense }: VoidExpenseDialogProps) {
  const t = useTranslations("dashExpenses");
  const tApiErrors = useTranslations("apiErrors");
  const tFormErrors = useTranslations("formErrors");
  const router = useRouter();
  const { toast } = useToast();

  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function submit(): void {
    setError(null);
    startTransition(async () => {
      try {
        await expensesApi.void(expense.id, reason);
        toast({ tone: "success", title: t("detail.voided", { number: expense.number }) });
        onOpenChange(false);
        router.refresh();
      } catch (err) {
        setError(expenseApiErrorMessage(err, tFormErrors, tApiErrors, t("detail.voidError")));
      }
    });
  }

  return (
    <DashboardDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("detail.voidTitle", { number: expense.number })}
      subtitle={t("detail.voidMessage")}
      submitLabel={t("detail.voidConfirm")}
      pending={pending}
      onSubmit={submit}
      error={error}
      danger
    >
      <DashboardField label={t("detail.voidReason")}>
        <Input
          size="control-md"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          maxLength={MAX_VOID_REASON_LENGTH}
          autoComplete="off"
          dir="auto"
        />
      </DashboardField>
    </DashboardDialog>
  );
}
