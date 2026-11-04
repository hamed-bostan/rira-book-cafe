"use client";

import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";

import { useStockDialogs } from "./StockDialogsProvider";

type InventoryHeaderActionsProps = {
  /** The item a count opens on — the first in the list. */
  countItemId: string | undefined;
  /** The item a delivery opens on — the first that's low or out, if any. */
  receiveItemId: string | undefined;
};

/**
 * "New stock item", "Count stock" and "Receive delivery" beside the page title,
 * each opening its dialog. With no items yet there's nothing to count or receive,
 * so only "New stock item" is offered — not two buttons that can't be pressed.
 */
export function InventoryHeaderActions({ countItemId, receiveItemId }: InventoryHeaderActionsProps) {
  const t = useTranslations("dashInventory");
  const { openDialog } = useStockDialogs();

  return (
    <>
      <Button
        size="control-md"
        type="button"
        variant="secondary"
        className="gap-2 px-3"
        onClick={() => openDialog("newItem")}
      >
        <Icon icon={Plus} size="icon-md" />
        {t("item.newTitle")}
      </Button>
      {countItemId !== undefined ? (
        <Button
          size="control-md"
          type="button"
          variant="secondary"
          className="px-3"
          onClick={() => openDialog("count", countItemId)}
        >
          {t("count.heading")}
        </Button>
      ) : null}
      {receiveItemId !== undefined ? (
        <Button
          size="control-md"
          type="button"
          className="gap-2 px-4"
          onClick={() => openDialog("receive", receiveItemId)}
        >
          <Icon icon={Plus} size="icon-md" />
          {t("receive.heading")}
        </Button>
      ) : null}
    </>
  );
}
