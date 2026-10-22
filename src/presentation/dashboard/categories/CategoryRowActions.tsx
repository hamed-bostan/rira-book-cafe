"use client";

import { ChevronDown, ChevronUp, MoreHorizontal } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import type { Category, CategoryMoveDirection } from "@/src/domain/entities/Category";
import { useRouter } from "@/src/i18n/navigation";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuIconTrigger,
  DropdownMenuItem,
} from "@/src/presentation/design-system/components/DropdownMenu/DropdownMenu";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { categoriesApi } from "./category-api";
import { DeleteCategorySheet } from "./DeleteCategorySheet";

type CategoryRowActionsProps = {
  category: Pick<Category, "id" | "name" | "isActive" | "productCount">;
  /** First on the menu — it can't move up. */
  isFirst: boolean;
  /** Last on the menu — it can't move down. */
  isLast: boolean;
};

/** The bordered square the row's controls share: 44px on a phone, 36px from `sm`. */
const SQUARE = "size-11 sm:size-9";

/**
 * A category's controls: move it up or down the menu, and behind "⋯" Edit, Hide
 * from menu (or Show on menu) and Delete. Each writes over the REST API and then
 * `router.refresh()`es, so the list comes back from the server in its new order.
 */
export function CategoryRowActions({ category, isFirst, isLast }: CategoryRowActionsProps) {
  const t = useTranslations("dashCategories");
  const tApiErrors = useTranslations("apiErrors");
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = React.useTransition();
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  function move(direction: CategoryMoveDirection): void {
    startTransition(async () => {
      try {
        await categoriesApi.move(category.id, { direction });
        toast({
          tone: "success",
          title: direction === "up" ? t("movedUp", { name: category.name }) : t("movedDown", { name: category.name }),
        });
      } catch (err) {
        toast({ tone: "error", title: localizeApiError(err, tApiErrors, t("moveError")) });
      }
      router.refresh();
    });
  }

  function setShown(shown: boolean): void {
    startTransition(async () => {
      try {
        await categoriesApi.bulkUpdate([category.id], { type: shown ? "activate" : "deactivate" });
        toast({
          tone: "success",
          title: shown ? t("shownToast", { name: category.name }) : t("hiddenToast", { name: category.name }),
        });
      } catch (err) {
        toast({ tone: "error", title: localizeApiError(err, tApiErrors, t("updateError")) });
      }
      router.refresh();
    });
  }

  return (
    <div className="ms-auto flex shrink-0 items-center gap-2">
      <Button
        type="button"
        variant="secondary"
        iconOnly
        className={SQUARE}
        aria-label={t("moveUp", { name: category.name })}
        disabled={isFirst || pending}
        onClick={() => move("up")}
      >
        <Icon icon={ChevronUp} size="sm" className="sm:size-4" />
      </Button>
      <Button
        type="button"
        variant="secondary"
        iconOnly
        className={SQUARE}
        aria-label={t("moveDown", { name: category.name })}
        disabled={isLast || pending}
        onClick={() => move("down")}
      >
        <Icon icon={ChevronDown} size="sm" className="sm:size-4" />
      </Button>
      <DropdownMenu>
        <DropdownMenuIconTrigger
          disabled={pending}
          aria-label={t("rowActionsAria", { name: category.name })}
          appearance="outline"
        >
          <Icon icon={MoreHorizontal} size="sm" className="sm:size-4" />
        </DropdownMenuIconTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => router.push(`/dashboard/categories/${category.id}/edit`)}>
            {t("edit")}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setShown(!category.isActive)}>
            {category.isActive ? t("hide") : t("show")}
          </DropdownMenuItem>
          <DropdownMenuItem destructive onSelect={() => setConfirmDelete(true)}>
            {t("delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DeleteCategorySheet
        category={category}
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        onHide={() => setShown(false)}
      />
    </div>
  );
}
