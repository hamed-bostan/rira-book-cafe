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

/** "Count stock" and "Receive delivery" beside the page title, each opening its dialog. */
export function InventoryHeaderActions({ countItemId, receiveItemId }: InventoryHeaderActionsProps) {
  const t = useTranslations("dashInventory");
  const { openDialog } = useStockDialogs();

  return (
    <>
      <Button
        size="control-md"
        type="button"
        variant="secondary"
        className="px-3"
        disabled={countItemId === undefined}
        onClick={() => {
          if (countItemId !== undefined) openDialog("count", countItemId);
        }}
      >
        {t("count.heading")}
      </Button>
      <Button
        size="control-md"
        type="button"
        className="gap-2 px-4"
        disabled={receiveItemId === undefined}
        onClick={() => {
          if (receiveItemId !== undefined) openDialog("receive", receiveItemId);
        }}
      >
        <Icon icon={Plus} size="sm" />
        {t("receive.heading")}
      </Button>
    </>
  );
}
