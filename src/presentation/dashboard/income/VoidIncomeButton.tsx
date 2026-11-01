"use client";

import { useTranslations } from "next-intl";
import * as React from "react";

import type { Income } from "@/src/domain/entities/Income";
import { useRouter } from "@/src/i18n/navigation";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { Input } from "@/src/presentation/design-system/components/form/Input/Input";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { DashboardDialog } from "../DashboardDialog";
import { DashboardField } from "../DashboardField";
import { expenseApiErrorMessage } from "../expenses/expenseApiErrorMessage";

import { incomesApi } from "./income-api";

/** Matches the void schema. */
const MAX_VOID_REASON_LENGTH = 200;

/**
 * Void income entered by mistake, or handed back to the payer: its entry is reversed
 * today and the record stays, marked void. There's no undo, so it asks first.
 */
export function VoidIncomeButton({ income }: { income: Pick<Income, "id" | "number"> }) {
  const t = useTranslations("dashIncome");
  const tApiErrors = useTranslations("apiErrors");
  const tFormErrors = useTranslations("formErrors");
  const router = useRouter();
  const { toast } = useToast();

  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function submit(): void {
    setError(null);
    startTransition(async () => {
      try {
        await incomesApi.void(income.id, reason);
        toast({ tone: "success", title: t("voided", { number: income.number }) });
        setOpen(false);
        router.refresh();
      } catch (err) {
        setError(expenseApiErrorMessage(err, tFormErrors, tApiErrors, t("voidError")));
      }
    });
  }

  return (
    <>
      <Button type="button" variant="secondary" size="control-sm" className="px-3" onClick={() => setOpen(true)}>
        {t("void")}
      </Button>
      <DashboardDialog
        open={open}
        onOpenChange={setOpen}
        title={t("voidTitle", { number: income.number })}
        subtitle={t("voidMessage")}
        submitLabel={t("voidConfirm")}
        pending={pending}
        onSubmit={submit}
        error={error}
        danger
      >
        <DashboardField label={t("voidReason")}>
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
    </>
  );
}
