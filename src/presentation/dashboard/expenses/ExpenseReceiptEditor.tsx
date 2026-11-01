"use client";

import { useTranslations } from "next-intl";
import * as React from "react";

import { useRouter } from "@/src/i18n/navigation";
import { FormMessage } from "@/src/presentation/design-system/components/form/FormMessage/FormMessage";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { expensesApi } from "./expense-api";
import { expenseApiErrorMessage } from "./expenseApiErrorMessage";
import { ExpenseReceiptUpload } from "./ExpenseReceiptUpload";

type ExpenseReceiptEditorProps = { id: string; receiptUrl?: string };

/** An expense's receipt, changed in place: each change saves at once and the page re-reads it. */
export function ExpenseReceiptEditor({ id, receiptUrl }: ExpenseReceiptEditorProps) {
  const t = useTranslations("dashExpenses.receipt");
  const tApiErrors = useTranslations("apiErrors");
  const tFormErrors = useTranslations("formErrors");
  const router = useRouter();
  const { toast } = useToast();
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function save(url: string): void {
    setError(null);
    startTransition(async () => {
      try {
        await expensesApi.setReceipt(id, url);
        toast({ tone: "success", title: url ? t("saved") : t("removed") });
        router.refresh();
      } catch (err) {
        setError(expenseApiErrorMessage(err, tFormErrors, tApiErrors, t("saveFailed")));
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <ExpenseReceiptUpload value={receiptUrl} onChange={save} disabled={pending} />
      {error ? <FormMessage>{error}</FormMessage> : null}
    </div>
  );
}
