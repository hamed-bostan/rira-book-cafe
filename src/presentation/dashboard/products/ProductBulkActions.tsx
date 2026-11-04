"use client";

import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import type { ProductBulkAction } from "@/src/contracts/bulk-action-schema";
import type { Category } from "@/src/domain/entities/Category";
import type { ProductListItem } from "@/src/domain/entities/Product";
import { useRouter } from "@/src/i18n/navigation";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { useBulkSelection } from "@/src/presentation/dashboard/bulk";
import { DashboardDialog } from "@/src/presentation/dashboard/DashboardDialog";
import { DashboardFormField } from "@/src/presentation/dashboard/DashboardFormField";
import { FIELD_PICKER } from "@/src/presentation/dashboard/fieldStyles";
import { ControlledChoicePicker } from "@/src/presentation/dashboard/list";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/src/presentation/design-system/components/DropdownMenu/DropdownMenu";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { productsApi } from "./product-api";

/** The bar's buttons: quiet bordered ones, like the orders list's. */
const ACTION = "px-4";

type ProductBulkActionsProps = {
  /** The page's items — enough of each to tell which actions fit the selection. */
  products: Pick<ProductListItem, "id" | "name" | "isPublished" | "isFeatured" | "categoryId">[];
  /** Every category, in menu order, for "Move to…". */
  categories: Pick<Category, "id" | "name" | "parentId">[];
};

type ActionType = ProductBulkAction["type"] | "delete";

/**
 * The menu list's bulk actions for the ticked items: show on the menu, hide,
 * feature or stop featuring, move to another category, and delete (after a
 * confirm — it can't be undone). Each fits only the items it would change: the
 * label says how many when that isn't all of them, and one that fits none is
 * disabled.
 *
 * Every action reports what the server did, not what was asked: "5 items hidden,
 * 2 already were"; a delete names each item it had to leave and why (a book out on
 * loan or with guests waiting). Then `router.refresh()` brings the rows back from
 * the server and the selection clears.
 */
export function ProductBulkActions({ products, categories }: ProductBulkActionsProps) {
  const t = useTranslations("dashProducts");
  const tApiErrors = useTranslations("apiErrors");
  const router = useRouter();
  const { toast } = useToast();
  const { selected, clear } = useBulkSelection();
  const [pending, startTransition] = React.useTransition();
  const [active, setActive] = React.useState<ActionType | null>(null);
  const [moveOpen, setMoveOpen] = React.useState(false);
  const [target, setTarget] = React.useState("");
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [dialogError, setDialogError] = React.useState<string | null>(null);

  const chosen = products.filter((product) => selected.includes(product.id));
  const count = {
    publish: chosen.filter((product) => !product.isPublished).length,
    unpublish: chosen.filter((product) => product.isPublished).length,
    feature: chosen.filter((product) => !product.isFeatured).length,
    unfeature: chosen.filter((product) => product.isFeatured).length,
  };
  const movable = target ? chosen.filter((product) => product.categoryId !== target).length : chosen.length;

  /** "Hide" when it fits every ticked item, "Hide (2)" when it fits some. */
  function label(text: string, fits: number): string {
    return fits > 0 && fits < chosen.length ? t("bulkActionCount", { action: text, count: fits }) : text;
  }

  /** "Coffee" for a top-level category, "Drinks › Coffee" for a subcategory. */
  const names = new Map(categories.map((category) => [category.id, category.name]));
  const categoryLabel = (category: Pick<Category, "name" | "parentId">): string =>
    category.parentId
      ? t("subcategoryLabel", { parent: names.get(category.parentId) ?? "", name: category.name })
      : category.name;

  function doneMessage(action: ProductBulkAction, updated: number): string {
    switch (action.type) {
      case "publish":
        return t("bulkShownToast", { count: updated });
      case "unpublish":
        return t("bulkHiddenToast", { count: updated });
      case "feature":
        return t("bulkFeaturedToast", { count: updated });
      case "unfeature":
        return t("bulkUnfeaturedToast", { count: updated });
      case "assignCategory":
        return t("bulkMovedToast", { count: updated, category: names.get(action.categoryId) ?? "" });
    }
  }

  function apply(action: ProductBulkAction): void {
    setActive(action.type);
    setDialogError(null);
    const asked = chosen.length;
    startTransition(async () => {
      try {
        const { updated } = await productsApi.bulkUpdate(selected, action);
        const skipped = asked - updated;
        toast({
          tone: updated > 0 ? "success" : "info",
          title: updated > 0 ? doneMessage(action, updated) : t("bulkNone"),
          description: updated > 0 && skipped > 0 ? t("bulkSkipped", { count: skipped }) : undefined,
        });
        setMoveOpen(false);
        router.refresh();
        clear();
      } catch (err) {
        const message = localizeApiError(err, tApiErrors, t("updateError"));
        if (action.type === "assignCategory") setDialogError(message);
        else toast({ tone: "error", title: message });
      }
    });
  }

  function remove(): void {
    setActive("delete");
    setDialogError(null);
    startTransition(async () => {
      try {
        const { deleted, refused } = await productsApi.bulkRemove(selected);
        const inUse = refused.filter((item) => item.reason === "bookInUse").map((item) => item.name);
        toast({
          tone: deleted > 0 ? "success" : "error",
          title: deleted > 0 ? t("bulkDeletedToast", { count: deleted }) : t("bulkDeleteNone"),
          description:
            inUse.length > 0
              ? t("bulkDeleteRefused", { count: inUse.length, names: inUse.join(t("listSeparator")) })
              : undefined,
          // Long enough to read the names of what stayed.
          duration: inUse.length > 0 ? 10_000 : undefined,
        });
        setDeleteOpen(false);
        router.refresh();
        clear();
      } catch (err) {
        setDialogError(localizeApiError(err, tApiErrors, t("deleteError")));
        router.refresh();
      }
    });
  }

  return (
    <>
      <Button
        variant="secondary"
        size="control-md"
        className={ACTION}
        loading={pending && active === "publish"}
        disabled={pending || count.publish === 0}
        onClick={() => apply({ type: "publish" })}
      >
        {label(t("bulkShow"), count.publish)}
      </Button>
      <Button
        variant="secondary"
        size="control-md"
        className={ACTION}
        loading={pending && active === "unpublish"}
        disabled={pending || count.unpublish === 0}
        onClick={() => apply({ type: "unpublish" })}
      >
        {label(t("bulkHide"), count.unpublish)}
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild disabled={pending}>
          <Button
            variant="secondary"
            size="control-md"
            className={ACTION}
            loading={pending && (active === "feature" || active === "unfeature")}
          >
            {t("bulkFeatured")}
            <Icon icon={ChevronDown} size="icon-md" className="ms-1.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem disabled={count.feature === 0} onSelect={() => apply({ type: "feature" })}>
            {label(t("feature"), count.feature)}
          </DropdownMenuItem>
          <DropdownMenuItem disabled={count.unfeature === 0} onSelect={() => apply({ type: "unfeature" })}>
            {label(t("unfeature"), count.unfeature)}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Button
        variant="secondary"
        size="control-md"
        className={ACTION}
        disabled={pending}
        onClick={() => {
          setDialogError(null);
          setTarget("");
          setMoveOpen(true);
        }}
      >
        {t("bulkMove")}
      </Button>

      <Button
        variant="secondary"
        size="control-md"
        className={`${ACTION} border-error-border text-error-foreground hover:bg-error active:bg-error disabled:text-error-foreground`}
        disabled={pending}
        onClick={() => {
          setDialogError(null);
          setDeleteOpen(true);
        }}
      >
        {t("delete")}
      </Button>

      <DashboardDialog
        open={moveOpen}
        onOpenChange={setMoveOpen}
        title={t("bulkMoveTitle", { count: chosen.length })}
        subtitle={t("bulkMoveMessage")}
        submitLabel={t("bulkMoveConfirm")}
        blocked={!target || movable === 0}
        pending={pending && active === "assignCategory"}
        onSubmit={() => apply({ type: "assignCategory", categoryId: target })}
        preview={
          target && movable < chosen.length ? t("bulkMovePreview", { count: chosen.length - movable }) : undefined
        }
        error={dialogError}
      >
        <DashboardFormField label={t("categoryLabel")}>
          {(wiring) => (
            <ControlledChoicePicker
              id={wiring.id}
              label={t("categoryLabel")}
              placeholder={t("selectCategory")}
              value={target}
              onValueChange={setTarget}
              isActive={false}
              size="control-md"
              triggerClassName={FIELD_PICKER}
              options={categories.map((category) => ({ value: category.id, label: categoryLabel(category) }))}
            />
          )}
        </DashboardFormField>
      </DashboardDialog>

      <DashboardDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={t("bulkDeleteTitle", { count: chosen.length })}
        subtitle={t("bulkDeleteMessage")}
        submitLabel={t("deleteConfirm")}
        pending={pending && active === "delete"}
        onSubmit={remove}
        error={dialogError}
        danger
      />
    </>
  );
}
