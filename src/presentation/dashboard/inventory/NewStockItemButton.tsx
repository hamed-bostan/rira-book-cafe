"use client";

import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";

import { useStockDialogs } from "./StockDialogsProvider";

/** The empty list's way forward: make the first stock item. */
export function NewStockItemButton() {
  const t = useTranslations("dashInventory");
  const { openDialog } = useStockDialogs();

  return (
    <Button size="control-md" type="button" className="gap-2 px-4" onClick={() => openDialog("newItem")}>
      <Icon icon={Plus} size="icon-md" />
      {t("item.newTitle")}
    </Button>
  );
}
