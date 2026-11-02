"use client";

import { useTranslations } from "next-intl";
import * as React from "react";

import { useRouter } from "@/src/i18n/navigation";
import { Input } from "@/src/presentation/design-system/components/form/Input/Input";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { DashboardDialog } from "../DashboardDialog";
import { DashboardField } from "../DashboardField";
import { expenseApiErrorMessage } from "../expenses/expenseApiErrorMessage";

import { payRunsApi } from "./payroll-api";

/** The longest reason the reversing entries carry. */
const MAX_VOID_REASON_LENGTH = 200;

type VoidPayRunDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  id: string;
  month: string;
};

/** Void a run recorded by mistake. There's no undo, so it asks first, with room for a reason. */
export function VoidPayRunDialog({ open, onOpenChange, id, month }: VoidPayRunDialogProps) {
  const t = useTranslations("dashPayroll");
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
        await payRunsApi.void(id, reason);
        toast({ tone: "success", title: t("detail.voided", { month }) });
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
      title={t("detail.voidTitle", { month })}
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
