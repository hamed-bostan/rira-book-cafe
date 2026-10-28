"use client";

import { useTranslations } from "next-intl";
import * as React from "react";

import { useRouter } from "@/src/i18n/navigation";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { DashboardDialog } from "../DashboardDialog";

import { productsApi } from "./product-api";

type DeleteProductConfirmProps = {
  id: string;
  name: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * The confirm step behind a row's "Delete": the dashboard's dialog with no
 * fields — Back, or a red Delete — then a delete over the API. Opened from the
 * row's ⋯ menu, which owns `open`. A failure stays in the dialog, so the reason
 * reads in context and Delete can be pressed again.
 */
export function DeleteProductConfirm({ id, name, open, onOpenChange }: DeleteProductConfirmProps) {
  const t = useTranslations("dashProducts");
  const tApiErrors = useTranslations("apiErrors");
  const router = useRouter();
  const { toast } = useToast();
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

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
        setError(localizeApiError(err, tApiErrors, t("deleteError")));
      }
    });
  }

  function handleOpenChange(next: boolean): void {
    onOpenChange(next);
    if (!next) setError(null); // Drop a stale error once the dialog is dismissed.
  }

  return (
    <DashboardDialog
      open={open}
      onOpenChange={handleOpenChange}
      title={t("deleteTitle", { name })}
      subtitle={t("deleteMessage")}
      submitLabel={t("deleteConfirm")}
      pending={pending}
      onSubmit={handleConfirm}
      error={error}
      danger
    />
  );
}
