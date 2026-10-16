"use client";

import { EllipsisVertical, Pencil, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { useRouter } from "@/src/i18n/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuIconTrigger,
  DropdownMenuItem,
  DropdownMenuSeparator,
  Icon,
} from "@/src/presentation/design-system";

import { DeleteCategoryButton } from "./DeleteCategoryButton";

type CategoryRowActionsProps = {
  id: string;
  name: string;
  productCount: number;
};

/** Compact row commands; destructive work remains behind the existing confirmation sheet. */
export function CategoryRowActions({ id, name, productCount }: CategoryRowActionsProps) {
  const t = useTranslations("dashCategories");
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuIconTrigger className="size-11 @[48rem]:size-8" aria-label={t("rowActionsAria", { name })}>
          <EllipsisVertical aria-hidden className="size-4" />
        </DropdownMenuIconTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onSelect={() => router.push(`/dashboard/categories/${id}/edit`)}>
            <Icon icon={Pencil} size="sm" />
            {t("edit")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem destructive onSelect={() => setDeleteOpen(true)}>
            <Icon icon={Trash2} size="sm" />
            {t("delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <DeleteCategoryButton
        id={id}
        name={name}
        productCount={productCount}
        trigger="none"
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
      />
    </>
  );
}
