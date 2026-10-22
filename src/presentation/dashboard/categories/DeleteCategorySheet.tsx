"use client";

import { useLocale, useTranslations } from "next-intl";
import * as React from "react";

import type { Category } from "@/src/domain/entities/Category";
import { useRouter } from "@/src/i18n/navigation";
import { ApiError } from "@/src/lib/api/ApiError";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { formatNumber } from "@/src/lib/formatNumber";
import { ConfirmSheet } from "@/src/presentation/design-system/components/Sheet/ConfirmSheet";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { categoriesApi } from "./category-api";

type DeleteCategorySheetProps = {
  category: Pick<Category, "id" | "name" | "isActive" | "productCount">;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Hide the category instead — offered when it still has items. */
  onHide: () => void;
};

/**
 * Confirms a delete. A category that still has items can't be deleted (the API
 * refuses with 409 IN_USE), so instead of a Delete button that can only fail,
 * the sheet says what's in the way and offers the way out: hide the category,
 * or — if it's hidden already — go to its items to move or delete them.
 */
export function DeleteCategorySheet({ category, open, onOpenChange, onHide }: DeleteCategorySheetProps) {
  const t = useTranslations("dashCategories");
  const tApiErrors = useTranslations("apiErrors");
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const blocked = category.productCount > 0;

  function remove(): void {
    setError(null);
    startTransition(async () => {
      try {
        await categoriesApi.remove(category.id);
        toast({ tone: "success", title: t("deleted", { name: category.name }) });
        onOpenChange(false);
        // Re-run the server render so the list reflects the delete — the server
        // stays the source of truth instead of patching local state.
        router.refresh();
      } catch (err) {
        // Items added since this page rendered (409 IN_USE) carry the server's own
        // sentence naming what's in the way, until the refresh brings the new
        // count; every other failure gets the localized copy. The sheet stays
        // open in a failure state to retry.
        setError(
          err instanceof ApiError && err.code === "IN_USE"
            ? err.message
            : localizeApiError(err, tApiErrors, t("deleteError")),
        );
        router.refresh();
      }
    });
  }

  function confirm(): void {
    if (!blocked) {
      remove();
      return;
    }
    onOpenChange(false);
    if (category.isActive) onHide();
    else router.push(`/dashboard/products?categoryId=${encodeURIComponent(category.id)}`);
  }

  return (
    <ConfirmSheet
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setError(null); // Drop a stale error once the sheet is dismissed.
      }}
      pending={pending}
      // Once the refresh after a refused delete lands, the count says why and the
      // blocked copy takes over from the server's sentence.
      title={error && !blocked ? t("deleteErrorTitle") : t("deleteTitle", { name: category.name })}
      message={
        blocked
          ? t("deleteBlocked", {
              name: category.name,
              count: category.productCount,
              formatted: formatNumber(category.productCount, locale),
            })
          : (error ?? t("deleteMessage"))
      }
      confirmLabel={
        blocked ? (category.isActive ? t("hide") : t("seeItems")) : error ? t("deleteTryAgain") : t("deleteConfirm")
      }
      onConfirm={confirm}
    />
  );
}
