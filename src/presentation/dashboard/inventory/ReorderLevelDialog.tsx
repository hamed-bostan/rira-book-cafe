"use client";

import { useLocale, useTranslations } from "next-intl";
import * as React from "react";

import { countField } from "@/src/contracts/money-fields";
import type { StockItem } from "@/src/domain/entities/Inventory";
import { useRouter } from "@/src/i18n/navigation";
import { Input } from "@/src/presentation/design-system/components/form/Input/Input";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { DashboardField } from "../DashboardField";

import { inventoryApi } from "./inventory-api";
import { stockApiErrorMessage } from "./stockApiErrorMessage";
import { StockDialog } from "./StockDialog";
import { formatStockQuantity, typedNumber } from "./stockFormat";
import { StockItemSelect } from "./StockItemSelect";

type ReorderLevelDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: readonly StockItem[];
  initialItemId: string;
};

/** The level as the field shows it: blank when the item has none. */
function levelText(item: StockItem | undefined): string {
  return item?.reorderLevel === undefined ? "" : String(item.reorderLevel);
}

/**
 * The level at which an item is flagged as running low. Before saving it says
 * when that will happen — straight away, if there's already no more than that on
 * hand. Left blank, the item is only flagged once it runs out.
 */
export function ReorderLevelDialog({ open, onOpenChange, items, initialItemId }: ReorderLevelDialogProps) {
  const t = useTranslations("dashInventory");
  const tApiErrors = useTranslations("apiErrors");
  const tFormErrors = useTranslations("formErrors");
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();

  const [itemId, setItemId] = React.useState(initialItemId);
  const [level, setLevel] = React.useState(() => levelText(items.find((item) => item.id === initialItemId)));
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const item = items.find((candidate) => candidate.id === itemId);
  const unit = item ? t(`unit.${item.unit}`) : "";
  const amount = (value: number): string => t("quick.quantity", { quantity: formatStockQuantity(value, locale), unit });

  const cleared = level.trim() === "";
  const parsed = countField.safeParse(level);
  const typed = typedNumber(level);
  // A negative number broke the "zero or more" rule, and says so; anything else
  // that isn't a level gets the format's copy.
  const fieldError =
    !cleared && !parsed.success
      ? typed !== undefined && typed < 0
        ? t("quick.levelNegative")
        : t("quick.levelInvalid")
      : undefined;
  const unchanged =
    item !== undefined && (cleared ? item.reorderLevel === undefined : parsed.data === item.reorderLevel);
  const ready = item !== undefined && (cleared || parsed.success) && !unchanged;

  let preview: string | undefined;
  if (item && cleared) preview = t("quick.levelNone");
  else if (item && parsed.success) {
    preview =
      parsed.data >= item.onHand
        ? t("quick.levelNow", { quantity: amount(item.onHand) })
        : t("quick.levelAt", { quantity: amount(parsed.data) });
  }

  function pick(id: string): void {
    setItemId(id);
    setLevel(levelText(items.find((candidate) => candidate.id === id)));
  }

  function submit(): void {
    if (!item) return;
    const next = parsed.success && !cleared ? parsed.data : undefined;
    setError(null);
    startTransition(async () => {
      try {
        await inventoryApi.setReorderLevel(item.id, { reorderLevel: level });
        toast({
          tone: "success",
          title:
            next === undefined
              ? t("quick.levelCleared", { name: item.name })
              : t("quick.levelSaved", { name: item.name, quantity: amount(next) }),
        });
        onOpenChange(false);
        router.refresh();
      } catch (err) {
        setError(stockApiErrorMessage(err, tFormErrors, tApiErrors, t("reorderError")));
      }
    });
  }

  return (
    <StockDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("quick.levelTitle")}
      subtitle={t("quick.levelSub")}
      submitLabel={t("quick.levelSubmit")}
      blocked={!ready}
      pending={pending}
      onSubmit={submit}
      preview={preview}
      error={fieldError ?? error}
    >
      <StockItemSelect items={items} value={itemId} onChange={pick} />
      <DashboardField label={t("quick.levelLabel", { unit })} hint={t("quick.levelHint")}>
        <Input
          size="control-md"
          value={level}
          onChange={(event) => setLevel(event.target.value)}
          inputMode="decimal"
          autoComplete="off"
          placeholder="0"
          dir="ltr"
        />
      </DashboardField>
    </StockDialog>
  );
}
