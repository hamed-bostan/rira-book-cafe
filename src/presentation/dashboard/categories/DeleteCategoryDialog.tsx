"use client";

import { useLocale, useTranslations } from "next-intl";
import * as React from "react";

import type { Category } from "@/src/domain/entities/Category";
import { Link, useRouter } from "@/src/i18n/navigation";
import { ApiError } from "@/src/lib/api/ApiError";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { formatNumber } from "@/src/lib/formatNumber";
import { cn } from "@/src/lib/utils";
import { focusRing } from "@/src/presentation/design-system/components/shared/focusRing";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { DashboardDialog } from "../DashboardDialog";

import { categoriesApi } from "./category-api";

type DeleteCategoryDialogProps = {
  category: Pick<Category, "id" | "name" | "isActive" | "productCount">;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Hide the category instead — offered when it still has items. */
  onHide: () => void;
};

const WAY_OUT = "font-medium text-primary underline underline-offset-4 hover:text-primary-hover";

/**
 * Confirms a delete: Back, or a red Delete. A category that still has items can't
 * be deleted (the API refuses with 409 IN_USE), so then Delete stays dimmed, the
 * dialog says what's in the way, and offers the way out — hide the category, or,
 * if it's hidden already, go to its items to move or delete them.
 */
export function DeleteCategoryDialog({ category, open, onOpenChange, onHide }: DeleteCategoryDialogProps) {
  const t = useTranslations("dashCategories");
  const tApiErrors = useTranslations("apiErrors");
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const blocked = category.productCount > 0;
  const items = { count: category.productCount, formatted: formatNumber(category.productCount, locale) };

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
        // count and the blocked copy takes over; every other failure gets the
        // localized copy. The dialog stays open to try again.
        setError(
          err instanceof ApiError && err.code === "IN_USE"
            ? err.message
            : localizeApiError(err, tApiErrors, t("deleteError")),
        );
        router.refresh();
      }
    });
  }

  function handleOpenChange(next: boolean): void {
    onOpenChange(next);
    if (!next) setError(null); // Drop a stale error once the dialog is dismissed.
  }

  function hide(): void {
    handleOpenChange(false);
    onHide();
  }

  return (
    <DashboardDialog
      open={open}
      onOpenChange={handleOpenChange}
      title={t("deleteTitle", { name: category.name })}
      subtitle={blocked ? t("deleteBlockedSub", { name: category.name }) : t("deleteMessage")}
      submitLabel={t("deleteConfirm")}
      blocked={blocked}
      pending={pending}
      onSubmit={remove}
      error={blocked ? (category.isActive ? t("deleteBlocked", items) : t("deleteBlockedHidden", items)) : error}
      danger
      aside={
        blocked ? (
          <p className="text-body-small text-muted-foreground sm:text-body-caption">
            {category.isActive ? (
              <button type="button" onClick={hide} className={cn(WAY_OUT, focusRing)}>
                {t("hideInstead")}
              </button>
            ) : (
              <Link
                href={`/dashboard/products?categoryId=${encodeURIComponent(category.id)}`}
                onClick={() => handleOpenChange(false)}
                className={cn(WAY_OUT, focusRing)}
              >
                {t("seeItems")}
              </Link>
            )}
          </p>
        ) : null
      }
    />
  );
}
