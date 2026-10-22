"use client";

import { useLocale, useTranslations } from "next-intl";
import * as React from "react";

import { countField } from "@/src/contracts/money-fields";
import { roundQuantity, type StockItem } from "@/src/domain/entities/Inventory";
import { useRouter } from "@/src/i18n/navigation";
import { formatMoney } from "@/src/lib/formatMoney";
import { Input } from "@/src/presentation/design-system/components/form/Input/Input";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { inventoryApi } from "./inventory-api";
import { stockApiErrorMessage } from "./stockApiErrorMessage";
import { StockDialog } from "./StockDialog";
import { formatStockQuantity } from "./stockFormat";
import { StockItemSelect } from "./StockItemSelect";

type CountStockDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: readonly StockItem[];
  initialItemId: string;
  /** Whether the viewer sees costs — the difference's value is only previewed for them. */
  costsVisible: boolean;
  /** Today on the cafe calendar — the count's date. */
  today: string;
};

/**
 * A count of one item, from the list: what's actually on the shelf. Before saving
 * it says how that compares with what the system expects — matching, missing or
 * extra — and the difference is posted to inventory variance like any count. The
 * full count page is still the way to count several items in one go.
 */
export function CountStockDialog({
  open,
  onOpenChange,
  items,
  initialItemId,
  costsVisible,
  today,
}: CountStockDialogProps) {
  const t = useTranslations("dashInventory");
  const tApiErrors = useTranslations("apiErrors");
  const tFormErrors = useTranslations("formErrors");
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();

  const [itemId, setItemId] = React.useState(initialItemId);
  const [counted, setCounted] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const item = items.find((candidate) => candidate.id === itemId);
  const unit = item ? t(`unit.${item.unit}`) : "";
  const amount = (value: number): string => t("quick.quantity", { quantity: formatStockQuantity(value, locale), unit });

  const parsed = countField.safeParse(counted);
  const fieldError = counted.trim() !== "" && !parsed.success ? t("count.invalid") : undefined;
  const ready = item !== undefined && parsed.success;

  let preview: string | undefined;
  if (item && parsed.success) {
    const difference = roundQuantity(parsed.data - item.onHand);
    const worth = formatMoney(Math.abs(difference * item.averageCost), locale);
    preview =
      difference === 0
        ? t("quick.countMatches")
        : difference < 0
          ? costsVisible
            ? t("quick.countLessWorth", { quantity: amount(-difference), amount: worth })
            : t("quick.countLess", { quantity: amount(-difference) })
          : costsVisible
            ? t("quick.countMoreWorth", { quantity: amount(difference), amount: worth })
            : t("quick.countMore", { quantity: amount(difference) });
  }

  function submit(): void {
    if (!item || !parsed.success) return;
    const onShelf = parsed.data;
    setError(null);
    startTransition(async () => {
      try {
        await inventoryApi.count({ date: today, note: "", lines: [{ ingredientId: item.id, counted }] });
        toast({ tone: "success", title: t("quick.countSaved", { name: item.name, quantity: amount(onShelf) }) });
        onOpenChange(false);
        router.refresh();
      } catch (err) {
        setError(stockApiErrorMessage(err, tFormErrors, tApiErrors, t("count.error")));
      }
    });
  }

  return (
    <StockDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("count.heading")}
      subtitle={t("quick.countSub")}
      submitLabel={t("quick.countSubmit")}
      blocked={!ready}
      pending={pending}
      onSubmit={submit}
      preview={preview}
      error={fieldError ?? error}
      fullForm={{ prompt: t("quick.countFull"), label: t("quick.countFullLink"), href: "/dashboard/inventory/count" }}
    >
      <StockItemSelect items={items} value={itemId} onChange={setItemId} />
      <label className="flex flex-col gap-1.5 text-body-small-emphasis text-foreground">
        {t("quick.countedLabel", { unit })}
        <Input
          value={counted}
          onChange={(event) => setCounted(event.target.value)}
          inputMode="decimal"
          autoComplete="off"
          placeholder="0"
          dir="ltr"
        />
        {item ? (
          <span className="text-body-small font-normal text-muted-foreground sm:text-body-caption">
            {t("quick.expected", { quantity: amount(item.onHand) })}
          </span>
        ) : null}
      </label>
    </StockDialog>
  );
}
