"use client";

import { MoreHorizontal } from "lucide-react";
import { useTranslations } from "next-intl";

import { Link } from "@/src/i18n/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuIconTrigger,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/src/presentation/design-system/components/DropdownMenu/DropdownMenu";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";

import { useStockDialogs } from "./StockDialogsProvider";

type StockRowActionsProps = {
  id: string;
  name: string;
  /** Draws the stock-changing commands; the history is a read anyone here may open. */
  canManage: boolean;
};

/**
 * A stock item's "⋯": receive a delivery of it, count it, change its reorder
 * level or write some off — each opening its dialog on this item — and its
 * history of movements.
 */
export function StockRowActions({ id, name, canManage }: StockRowActionsProps) {
  const t = useTranslations("dashInventory");
  const { openDialog } = useStockDialogs();

  return (
    <DropdownMenu>
      <DropdownMenuIconTrigger aria-label={t("moreActionsAria", { name })} appearance="secondary">
        <Icon icon={MoreHorizontal} size="sm" className="sm:size-4" />
      </DropdownMenuIconTrigger>
      <DropdownMenuContent align="end">
        {canManage ? (
          <>
            <DropdownMenuItem onSelect={() => openDialog("receive", id)}>{t("receive.heading")}</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => openDialog("count", id)}>{t("count.heading")}</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => openDialog("level", id)}>{t("quick.levelTitle")}</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => openDialog("waste", id)}>{t("waste.confirm")}</DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        ) : null}
        <DropdownMenuItem asChild>
          <Link href={`/dashboard/inventory/movements?item=${id}`}>{t("movements.heading")}</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
