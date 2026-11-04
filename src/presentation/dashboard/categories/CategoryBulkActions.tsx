"use client";

import { useTranslations } from "next-intl";
import * as React from "react";

import type { Category } from "@/src/domain/entities/Category";
import { useRouter } from "@/src/i18n/navigation";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { useBulkSelection } from "@/src/presentation/dashboard/bulk";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { categoriesApi } from "./category-api";

type CategoryBulkActionsProps = {
  /** The list's categories — enough to tell which actions fit the selection. */
  categories: Pick<Category, "id" | "name" | "isActive" | "parentId">[];
};

type Action = "activate" | "deactivate";

/**
 * The categories list's bulk actions: show the selection on the menu, or hide
 * it. Each fits only the categories not already that way — the label says how
 * many when that isn't all of them, and one that fits none is disabled. The
 * server skips what's already there too, and the toast says how many changed and
 * how many were left as they were.
 *
 * Hiding a parent takes its subcategories' items off the menu with it — the
 * button's hint says so when a parent is in the selection. Nothing here is
 * destructive (both undo each other), so neither asks first.
 */
export function CategoryBulkActions({ categories }: CategoryBulkActionsProps) {
  const t = useTranslations("dashCategories");
  const tApiErrors = useTranslations("apiErrors");
  const router = useRouter();
  const { toast } = useToast();
  const { selected, clear } = useBulkSelection();
  const [pending, startTransition] = React.useTransition();
  const [active, setActive] = React.useState<Action | null>(null);

  const chosen = categories.filter((category) => selected.includes(category.id));
  const toShow = chosen.filter((category) => !category.isActive).length;
  const toHide = chosen.filter((category) => category.isActive).length;
  const hidesParent = chosen.some(
    (category) => category.isActive && categories.some((other) => other.parentId === category.id),
  );

  function label(text: string, count: number): string {
    return count > 0 && count < chosen.length ? t("bulkActionCount", { action: text, count }) : text;
  }

  function apply(action: Action): void {
    setActive(action);
    const asked = chosen.length;
    startTransition(async () => {
      try {
        const { updated } = await categoriesApi.bulkUpdate(selected, { type: action });
        const done =
          action === "activate" ? t("bulkShownToast", { count: updated }) : t("bulkHiddenToast", { count: updated });
        const skipped = asked - updated;
        toast({
          tone: "success",
          title: done,
          description: skipped > 0 ? t("bulkSkipped", { count: skipped }) : undefined,
        });
        router.refresh();
        clear();
      } catch (err) {
        toast({ tone: "error", title: localizeApiError(err, tApiErrors, t("updateError")) });
      }
    });
  }

  return (
    <>
      <Button
        variant="secondary"
        size="control-md"
        className="px-4"
        loading={pending && active === "activate"}
        disabled={pending || toShow === 0}
        onClick={() => apply("activate")}
      >
        {label(t("show"), toShow)}
      </Button>
      <Button
        variant="secondary"
        size="control-md"
        className="px-4"
        loading={pending && active === "deactivate"}
        disabled={pending || toHide === 0}
        onClick={() => apply("deactivate")}
        title={hidesParent ? t("bulkHideParentHint") : undefined}
      >
        {label(t("hide"), toHide)}
      </Button>
    </>
  );
}
