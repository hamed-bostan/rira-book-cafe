"use client";

import { useLocale, useTranslations } from "next-intl";
import * as React from "react";

import { EXPENSE_PAYMENT_CHOICES } from "@/src/contracts/expense-schema";
import { moneyField, quantityField } from "@/src/contracts/money-fields";
import { MAX_EXPENSE_DESCRIPTION_LENGTH } from "@/src/domain/entities/Expense";
import { receiveStock, type StockItem } from "@/src/domain/entities/Inventory";
import { useRouter } from "@/src/i18n/navigation";
import { moneyUnit } from "@/src/lib/formatMoney";
import { formErrorMessage } from "@/src/lib/formErrorMessage";
import { Input } from "@/src/presentation/design-system/components/form/Input/Input";
import { Select } from "@/src/presentation/design-system/components/form/Select/Select";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { inventoryApi } from "./inventory-api";
import { stockApiErrorMessage } from "./stockApiErrorMessage";
import { StockDialog } from "./StockDialog";
import { formatStockQuantity, formatUnitCost } from "./stockFormat";
import { StockItemSelect } from "./StockItemSelect";

type PaymentChoice = (typeof EXPENSE_PAYMENT_CHOICES)[number];

type ReceiveDeliveryDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: readonly StockItem[];
  initialItemId: string;
  /** Whether the viewer sees costs — the new average cost is only previewed for them. */
  costsVisible: boolean;
  /** Today on the cafe calendar — the delivery's date. */
  today: string;
};

/**
 * A delivery of one item, from the list: how much came in and what it cost in
 * all, and whether it's paid. Before saving it shows what's on hand afterwards and
 * the new average cost. It's booked like the full delivery form — stock in at
 * cost, the bill owed or paid — which remains the way to enter several items, a
 * supplier or VAT.
 */
export function ReceiveDeliveryDialog({
  open,
  onOpenChange,
  items,
  initialItemId,
  costsVisible,
  today,
}: ReceiveDeliveryDialogProps) {
  const t = useTranslations("dashInventory");
  const tExpenses = useTranslations("dashExpenses");
  const tApiErrors = useTranslations("apiErrors");
  const tFormErrors = useTranslations("formErrors");
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();

  const [itemId, setItemId] = React.useState(initialItemId);
  const [quantity, setQuantity] = React.useState("");
  const [cost, setCost] = React.useState("");
  const [payment, setPayment] = React.useState<PaymentChoice>("unpaid");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const item = items.find((candidate) => candidate.id === itemId);
  const unit = item ? t(`unit.${item.unit}`) : "";
  const amount = (value: number): string => t("quick.quantity", { quantity: formatStockQuantity(value, locale), unit });

  const parsedQuantity = quantityField.safeParse(quantity);
  const parsedCost = moneyField.safeParse(cost);
  const fieldError =
    quantity.trim() !== "" && !parsedQuantity.success
      ? formErrorMessage(tFormErrors, parsedQuantity.error.issues[0]?.message)
      : cost.trim() !== "" && !parsedCost.success
        ? formErrorMessage(tFormErrors, parsedCost.error.issues[0]?.message)
        : undefined;
  const ready = item !== undefined && parsedQuantity.success && parsedCost.success;

  let preview: string | undefined;
  if (item && parsedQuantity.success && parsedCost.success) {
    const after = receiveStock(item, parsedQuantity.data, parsedCost.data);
    preview = costsVisible
      ? t("quick.receivePreviewWithCost", {
          from: amount(item.onHand),
          to: amount(after.onHand),
          cost: `${formatUnitCost(after.averageCost, locale)} ${moneyUnit(locale)}`,
          unit,
        })
      : t("quick.onHandChange", { from: amount(item.onHand), to: amount(after.onHand) });
  }

  function submit(): void {
    if (!item || !parsedQuantity.success) return;
    const received = parsedQuantity.data;
    setError(null);
    startTransition(async () => {
      try {
        await inventoryApi.receive({
          date: today,
          supplierId: "",
          description: t("quick.receiveDescription", { name: item.name }).slice(0, MAX_EXPENSE_DESCRIPTION_LENGTH),
          lines: [{ ingredientId: item.id, quantity, cost }],
          vatAmount: "",
          payment,
        });
        toast({ tone: "success", title: t("quick.receiveSaved", { quantity: amount(received), name: item.name }) });
        onOpenChange(false);
        router.refresh();
      } catch (err) {
        setError(stockApiErrorMessage(err, tFormErrors, tApiErrors, t("receive.error")));
      }
    });
  }

  return (
    <StockDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("receive.heading")}
      subtitle={t("quick.receiveSub")}
      submitLabel={t("quick.receiveSubmit")}
      blocked={!ready}
      pending={pending}
      onSubmit={submit}
      preview={preview}
      error={fieldError ?? error}
      fullForm={{
        prompt: t("quick.receiveFull"),
        label: t("quick.receiveFullLink"),
        href: "/dashboard/inventory/receive",
      }}
    >
      <StockItemSelect items={items} value={itemId} onChange={setItemId} />
      <label className="flex flex-col gap-1.5 text-body-small-emphasis text-foreground">
        {t("quick.quantityLabel", { unit })}
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
        {t("quick.costLabel")}
        <Input
          size="control-md"
          value={cost}
          onChange={(event) => setCost(event.target.value)}
          inputMode="numeric"
          autoComplete="off"
          placeholder="0"
          dir="ltr"
        />
        <span className="text-body-small font-normal text-muted-foreground sm:text-body-caption">
          {t("quick.costHint")}
        </span>
      </label>
      <label className="flex flex-col gap-1.5 text-body-small-emphasis text-foreground">
        {tExpenses("form.paymentLabel")}
        <Select
          size="control-md"
          value={payment}
          onChange={(event) =>
            setPayment(EXPENSE_PAYMENT_CHOICES.find((choice) => choice === event.target.value) ?? "unpaid")
          }
        >
          {EXPENSE_PAYMENT_CHOICES.map((choice) => (
            <option key={choice} value={choice}>
              {tExpenses(`form.payment.${choice}`)}
            </option>
          ))}
        </Select>
      </label>
    </StockDialog>
  );
}
