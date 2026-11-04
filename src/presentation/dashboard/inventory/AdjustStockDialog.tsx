"use client";

import { useLocale, useTranslations } from "next-intl";
import * as React from "react";

import { quantityField } from "@/src/contracts/money-fields";
import {
  ADJUSTMENT_DIRECTIONS,
  ADJUSTMENT_REASONS,
  adjustmentNeedsNote,
  issueStock,
  roundQuantity,
  type AdjustmentReason,
  type StockItem,
} from "@/src/domain/entities/Inventory";
import { useRouter } from "@/src/i18n/navigation";
import { formatMoney } from "@/src/lib/formatMoney";
import { formErrorMessage } from "@/src/lib/formErrorMessage";
import { Input } from "@/src/presentation/design-system/components/form/Input/Input";
import { Select } from "@/src/presentation/design-system/components/form/Select/Select";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { DashboardField } from "../DashboardField";

import { inventoryApi } from "./inventory-api";
import { stockApiErrorMessage } from "./stockApiErrorMessage";
import { StockDialog } from "./StockDialog";
import { formatStockQuantity, typedNumber } from "./stockFormat";
import { StockItemSelect } from "./StockItemSelect";

type AdjustStockDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: readonly StockItem[];
  initialItemId: string;
  /** Whether the viewer sees costs — the adjustment's worth is only previewed for them. */
  costsVisible: boolean;
  /** Today on the cafe calendar — the adjustment's date. */
  today: string;
};

type Direction = "in" | "out";

/** The way a reason moves stock when it can only go one way; a correction or "other" asks. */
function directionFor(reason: AdjustmentReason, chosen: Direction): Direction {
  const fixed = ADJUSTMENT_DIRECTIONS[reason];
  return fixed === "either" ? chosen : fixed;
}

/**
 * A manual change with a reason: found stock in; breakage, a staff meal or a
 * tasting out; a correction either way. Before saving it shows what's on hand
 * afterwards (and, to those who see costs, what it's worth). "Other" asks for a
 * note saying what happened.
 */
export function AdjustStockDialog({
  open,
  onOpenChange,
  items,
  initialItemId,
  costsVisible,
  today,
}: AdjustStockDialogProps) {
  const t = useTranslations("dashInventory");
  const tApiErrors = useTranslations("apiErrors");
  const tFormErrors = useTranslations("formErrors");
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();

  const [itemId, setItemId] = React.useState(initialItemId);
  const [reason, setReason] = React.useState<AdjustmentReason>("correction");
  const [chosen, setChosen] = React.useState<Direction>("out");
  const [quantity, setQuantity] = React.useState("");
  const [note, setNote] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const item = items.find((candidate) => candidate.id === itemId);
  const unit = item ? t(`unit.${item.unit}`) : "";
  const amount = (value: number): string => t("quick.quantity", { quantity: formatStockQuantity(value, locale), unit });
  const direction = directionFor(reason, chosen);
  const fixed = ADJUSTMENT_DIRECTIONS[reason] !== "either";

  const parsed = quantityField.safeParse(quantity);
  const typed = typedNumber(quantity);
  const noteMissing = adjustmentNeedsNote(reason) && note.trim() === "";
  const fieldError =
    quantity.trim() !== "" && !parsed.success
      ? typed !== undefined && typed <= 0
        ? t("quick.quantityPositive")
        : formErrorMessage(tFormErrors, parsed.error.issues[0]?.message)
      : undefined;
  const ready = item !== undefined && parsed.success && !noteMissing;

  let preview: string | undefined;
  if (item && parsed.success) {
    const value =
      direction === "out" ? issueStock(item, parsed.data).value : Math.round(item.averageCost * parsed.data);
    const after = roundQuantity(item.onHand + (direction === "in" ? parsed.data : -parsed.data));
    const change = t("quick.onHandChange", { from: amount(item.onHand), to: amount(after) });
    preview = costsVisible
      ? `${change} ${t(`adjust.account.${reason}`, { amount: formatMoney(value, locale) })}`
      : change;
  } else if (noteMissing && parsed.success) preview = t("adjust.noteNeeded");

  function submit(): void {
    if (!item) return;
    setError(null);
    startTransition(async () => {
      try {
        await inventoryApi.adjust({ date: today, ingredientId: item.id, direction, quantity, reason, note });
        toast({ tone: "success", title: t("adjust.saved", { name: item.name }) });
        onOpenChange(false);
        router.refresh();
      } catch (err) {
        setError(stockApiErrorMessage(err, tFormErrors, tApiErrors, t("adjust.error")));
      }
    });
  }

  return (
    <StockDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("adjust.title")}
      subtitle={t("adjust.subtitle")}
      submitLabel={t("adjust.submit")}
      blocked={!ready}
      pending={pending}
      onSubmit={submit}
      preview={preview}
      error={fieldError ?? error}
    >
      <StockItemSelect items={items} value={itemId} onChange={setItemId} />
      <DashboardField label={t("adjust.reasonLabel")}>
        <Select
          size="control-md"
          value={reason}
          onChange={(event) =>
            setReason(ADJUSTMENT_REASONS.find((candidate) => candidate === event.target.value) ?? "correction")
          }
        >
          {ADJUSTMENT_REASONS.map((option) => (
            <option key={option} value={option}>
              {t(`adjust.reason.${option}`)}
            </option>
          ))}
        </Select>
      </DashboardField>
      <DashboardField label={t("adjust.directionLabel")} hint={fixed ? t(`adjust.fixed.${direction}`) : undefined}>
        <Select
          size="control-md"
          value={direction}
          disabled={fixed}
          onChange={(event) => setChosen(event.target.value === "in" ? "in" : "out")}
        >
          <option value="in">{t("adjust.direction.in")}</option>
          <option value="out">{t("adjust.direction.out")}</option>
        </Select>
      </DashboardField>
      <DashboardField label={t("adjust.quantityLabel", { unit })}>
        <Input
          size="control-md"
          value={quantity}
          onChange={(event) => setQuantity(event.target.value)}
          inputMode="decimal"
          autoComplete="off"
          placeholder="0"
          dir="ltr"
        />
      </DashboardField>
      <DashboardField label={adjustmentNeedsNote(reason) ? t("adjust.noteRequiredLabel") : t("adjust.noteLabel")}>
        <Input
          size="control-md"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={200}
          autoComplete="off"
          dir="auto"
          placeholder={t("adjust.notePlaceholder")}
        />
      </DashboardField>
    </StockDialog>
  );
}
