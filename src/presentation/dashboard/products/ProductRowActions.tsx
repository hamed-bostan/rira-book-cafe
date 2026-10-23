"use client";

import { MoreHorizontal } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import { useRouter } from "@/src/i18n/navigation";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuIconTrigger,
  DropdownMenuItem,
} from "@/src/presentation/design-system/components/DropdownMenu/DropdownMenu";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { DeleteProductConfirm } from "./DeleteProductConfirm";
import { productsApi } from "./product-api";

type ProductRowActionsProps = {
  id: string;
  name: string;
  isFeatured: boolean;
};

/**
 * A menu item's commands behind "⋯": Edit (the item's page), Feature on the
 * menu / Remove from featured, and Delete (which asks first). Each change writes
 * over the REST API and `router.refresh()`es.
 */
export function ProductRowActions({ id, name, isFeatured }: ProductRowActionsProps) {
  const t = useTranslations("dashProducts");
  const tApiErrors = useTranslations("apiErrors");
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = React.useTransition();
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  /** `undoable` is off for the undo itself, so its toast doesn't offer to undo the undo. */
  function setFeatured(featured: boolean, undoable = true): void {
    startTransition(async () => {
      try {
        await productsApi.bulkUpdate([id], { type: featured ? "feature" : "unfeature" });
        toast({
          tone: "success",
          title: featured ? t("featuredToast", { name }) : t("unfeaturedToast", { name }),
          onUndo: undoable ? () => setFeatured(!featured, false) : undefined,
        });
      } catch (err) {
        toast({ tone: "error", title: localizeApiError(err, tApiErrors, t("updateError")) });
      }
      router.refresh();
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuIconTrigger appearance="secondary" disabled={pending} aria-label={t("rowActionsAria", { name })}>
          <Icon icon={MoreHorizontal} size="sm" className="sm:size-4" />
        </DropdownMenuIconTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => router.push(`/dashboard/products/${id}/edit`)}>
            {t("edit")}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setFeatured(!isFeatured)}>
            {isFeatured ? t("unfeature") : t("feature")}
          </DropdownMenuItem>
          <DropdownMenuItem destructive onSelect={() => setDeleteOpen(true)}>
            {t("delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DeleteProductConfirm id={id} name={name} open={deleteOpen} onOpenChange={setDeleteOpen} />
    </>
  );
}
