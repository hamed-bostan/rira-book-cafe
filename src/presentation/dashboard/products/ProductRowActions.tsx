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

import { DeleteProductButton } from "./DeleteProductButton";

type ProductRowActionsProps = {
  id: string;
  name: string;
};

/** Product commands grouped behind one predictable, keyboard-accessible trigger. */
export function ProductRowActions({ id, name }: ProductRowActionsProps) {
  const t = useTranslations("dashProducts");
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuIconTrigger className="size-11 @4xl/products:size-8" aria-label={t("rowActionsAria", { name })}>
          <EllipsisVertical aria-hidden className="size-4" />
        </DropdownMenuIconTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onSelect={() => router.push(`/dashboard/products/${id}/edit`)}>
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

      <DeleteProductButton
        id={id}
        name={name}
        trigger="none"
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
      />
    </>
  );
}
