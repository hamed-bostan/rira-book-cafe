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
  /**
   * Draws receiving, counting and the reorder level. Writing off waste and the
   * history are open to anyone on the page (`inventory.view`).
   */
  canManage: boolean;
};

/**
 * A stock item's "⋯": receive a delivery of it, count it, change its reorder
 * level or write some off — each opening its dialog on this item — and its
 * history of movements. The waste dialog previews the loss's worth only to those
 * who see costs.
 */
export function StockRowActions({ id, name, canManage }: StockRowActionsProps) {
  const t = useTranslations("dashInventory");
  const { openDialog } = useStockDialogs();

  return (
    <DropdownMenu>
      <DropdownMenuIconTrigger aria-label={t("moreActionsAria", { name })} appearance="secondary">
        <Icon icon={MoreHorizontal} size="icon-md" />
      </DropdownMenuIconTrigger>
      <DropdownMenuContent align="end">
        {canManage ? (
          <>
            <DropdownMenuItem onSelect={() => openDialog("receive", id)}>{t("receive.heading")}</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => openDialog("count", id)}>{t("count.heading")}</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => openDialog("level", id)}>{t("quick.levelTitle")}</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => openDialog("adjust", id)}>{t("adjust.title")}</DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`/dashboard/inventory/returns/new?item=${id}`}>{t("returns.new")}</Link>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => openDialog("item", id)}>{t("item.edit")}</DropdownMenuItem>
          </>
        ) : null}
        {/* Floor staff record what they throw away: the waste API asks only for
            `inventory.view`, which is what this page is gated on. */}
        <DropdownMenuItem onSelect={() => openDialog("waste", id)}>{t("waste.confirm")}</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={`/dashboard/inventory/movements?item=${id}`}>{t("movements.heading")}</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
