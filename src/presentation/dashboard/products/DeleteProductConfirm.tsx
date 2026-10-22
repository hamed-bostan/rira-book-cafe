"use client";

import { useTranslations } from "next-intl";
import * as React from "react";

import { useRouter } from "@/src/i18n/navigation";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { ConfirmSheet } from "@/src/presentation/design-system/components/Sheet/ConfirmSheet";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { productsApi } from "./product-api";

type DeleteProductConfirmProps = {
  id: string;
  name: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * The confirm step behind a row's "Delete": the DS ConfirmSheet, then a delete
 * over the API. Opened from the row's ⋯ menu, which owns `open`.
 */
export function DeleteProductConfirm({ id, name, open, onOpenChange }: DeleteProductConfirmProps) {
  const t = useTranslations("dashProducts");
  const tApiErrors = useTranslations("apiErrors");
  const router = useRouter();
  const { toast } = useToast();
  const [error, setError] = React.useState<string | null>(null);
  const [, startTransition] = React.useTransition();

  function handleConfirm(): void {
    setError(null);
    startTransition(async () => {
      try {
        await productsApi.remove(id);
        onOpenChange(false);
        toast({ tone: "success", title: t("deleted", { name }) });
        // Re-run the server render so the list reflects the delete — the server
        // stays the source of truth instead of patching local state.
        router.refresh();
      } catch (err) {
        // Re-open the sheet in a failure state so the error reads in context and
        // the user can retry — instead of a disruptive window.alert.
        setError(localizeApiError(err, tApiErrors, t("deleteError")));
        onOpenChange(true);
      }
    });
  }

  function handleOpenChange(next: boolean): void {
    onOpenChange(next);
    if (!next) setError(null); // Drop a stale error once the sheet is dismissed.
  }

  return (
    <ConfirmSheet
      open={open}
      onOpenChange={handleOpenChange}
      title={error ? t("deleteErrorTitle") : t("deleteTitle", { name })}
      message={error ?? t("deleteMessage")}
      confirmLabel={error ? t("deleteTryAgain") : t("deleteConfirm")}
      onConfirm={handleConfirm}
    />
  );
}
