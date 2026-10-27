"use client";

import { useLocale, useTranslations } from "next-intl";
import * as React from "react";

import { quantityField } from "@/src/contracts/money-fields";
import { issueStock, type StockItem } from "@/src/domain/entities/Inventory";
import { useRouter } from "@/src/i18n/navigation";
import { formatMoney } from "@/src/lib/formatMoney";
import { formErrorMessage } from "@/src/lib/formErrorMessage";
import { Input } from "@/src/presentation/design-system/components/form/Input/Input";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { inventoryApi } from "./inventory-api";
import { stockApiErrorMessage } from "./stockApiErrorMessage";
import { StockDialog } from "./StockDialog";
import { formatStockQuantity } from "./stockFormat";
import { StockItemSelect } from "./StockItemSelect";

/** The longest reason a waste entry keeps. */
const MAX_REASON_LENGTH = 200;

type WasteDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: readonly StockItem[];
  initialItemId: string;
  /** Whether the viewer sees costs — what the waste is worth is only previewed for them. */
  costsVisible: boolean;
  /** Today on the cafe calendar — the entry's date. */
  today: string;
};

/**
 * Record spoiled, spilled or expired stock. It leaves Inventory at average cost
 * and shows on the P&L as waste; before saving, the dialog says what's left on
 * hand afterwards and what the loss is worth.
 */
export function WasteDialog({ open, onOpenChange, items, initialItemId, costsVisible, today }: WasteDialogProps) {
  const t = useTranslations("dashInventory");
  const tApiErrors = useTranslations("apiErrors");
  const tFormErrors = useTranslations("formErrors");
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();

  const [itemId, setItemId] = React.useState(initialItemId);
  const [quantity, setQuantity] = React.useState("");
  const [note, setNote] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const item = items.find((candidate) => candidate.id === itemId);
  const unit = item ? t(`unit.${item.unit}`) : "";
  const amount = (value: number): string => t("quick.quantity", { quantity: formatStockQuantity(value, locale), unit });

  const parsed = quantityField.safeParse(quantity);
  const fieldError =
    quantity.trim() !== "" && !parsed.success
      ? formErrorMessage(tFormErrors, parsed.error.issues[0]?.message)
      : undefined;
  const ready = item !== undefined && parsed.success;

  let preview: string | undefined;
  if (item && parsed.success) {
    const after = issueStock(item, parsed.data);
    preview = costsVisible
      ? t("quick.wastePreviewWorth", {
          from: amount(item.onHand),
          to: amount(after.state.onHand),
          amount: formatMoney(after.value, locale),
        })
      : t("quick.onHandChange", { from: amount(item.onHand), to: amount(after.state.onHand) });
  }

  function submit(): void {
    if (!item) return;
    setError(null);
    startTransition(async () => {
      try {
        await inventoryApi.recordWaste({ date: today, ingredientId: item.id, quantity, note });
        toast({ tone: "success", title: t("waste.saved") });
        onOpenChange(false);
        router.refresh();
      } catch (err) {
        setError(stockApiErrorMessage(err, tFormErrors, tApiErrors, t("waste.error")));
      }
    });
  }

  return (
    <StockDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("waste.confirm")}
      subtitle={t("waste.description")}
      submitLabel={t("waste.confirm")}
      blocked={!ready}
      pending={pending}
      onSubmit={submit}
      preview={preview}
      error={fieldError ?? error}
    >
      <StockItemSelect items={items} value={itemId} onChange={setItemId} />
      <label className="flex flex-col gap-1.5 text-body-small-emphasis text-foreground">
        {t("waste.quantityLabel", { unit })}
        <Input
          size="control-md"
          value={quantity}
          onChange={(event) => setQuantity(event.target.value)}
          inputMode="decimal"
          autoComplete="off"
          placeholder="0"
          dir="ltr"
        />
      </label>
      <label className="flex flex-col gap-1.5 text-body-small-emphasis text-foreground">
        {t("waste.noteLabel")}
        <Input
          size="control-md"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={MAX_REASON_LENGTH}
          autoComplete="off"
          dir="auto"
          placeholder={t("waste.notePlaceholder")}
        />
      </label>
    </StockDialog>
  );
}
