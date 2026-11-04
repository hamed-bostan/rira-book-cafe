"use client";

import { useLocale, useTranslations } from "next-intl";
import * as React from "react";

import { canLowerOrderItem, type Order } from "@/src/domain/entities/Order";
import { useRouter } from "@/src/i18n/navigation";
import { ApiError } from "@/src/lib/api/ApiError";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { formatMoney } from "@/src/lib/formatMoney";
import { formatNumber } from "@/src/lib/formatNumber";
import { formErrorMessage } from "@/src/lib/formErrorMessage";
import { cn } from "@/src/lib/utils";
import { DashboardDialog } from "@/src/presentation/dashboard/DashboardDialog";
import { FIELD_HINT, FIELD_LABEL } from "@/src/presentation/dashboard/fieldStyles";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { Select } from "@/src/presentation/design-system/components/form/Select/Select";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";
import { OrderItemOptions } from "@/src/presentation/orders/OrderItemOptions";

import { ordersApi } from "./order-api";

type ChangeOrderItemsDialogProps = {
  order: Pick<Order, "id" | "orderNumber" | "updatedAt" | "items">;
};

/**
 * Lower or take off lines of an order still being made: a quantity for each line,
 * down to "Remove". A line already served stays as it is — it has gone out to the
 * guest. Taking every line off isn't a change but a cancellation, so it's refused
 * here before it reaches the server. Writes over the API, then refreshes the server
 * render; the server re-prices the order.
 */
export function ChangeOrderItemsDialog({ order }: ChangeOrderItemsDialogProps) {
  const t = useTranslations("dashOrders");
  const tApiErrors = useTranslations("apiErrors");
  const tFormErrors = useTranslations("formErrors");
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [quantities, setQuantities] = React.useState<Readonly<Record<string, number>>>({});
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const quantityOf = (id: string, current: number): number => Math.min(quantities[id] ?? current, current);
  const changed = order.items.flatMap((item) => {
    const quantity = quantityOf(item.id, item.quantity);
    return quantity !== item.quantity ? [{ item, quantity }] : [];
  });
  const left = order.items.filter((item) => quantityOf(item.id, item.quantity) > 0).length;
  const amount = changed.reduce((sum, { item, quantity }) => sum + item.unitPrice * (item.quantity - quantity), 0);
  const units = changed.reduce((sum, { item, quantity }) => sum + item.quantity - quantity, 0);

  function submit(): void {
    setError(null);
    startTransition(async () => {
      try {
        await ordersApi.update(order.id, {
          version: order.updatedAt,
          lines: changed.map(({ item, quantity }) => ({ itemId: item.id, quantity })),
        });
        toast({ tone: "success", title: t("edit.linesSaved", { number: order.orderNumber }) });
        setOpen(false);
        setQuantities({});
      } catch (err) {
        const field =
          err instanceof ApiError ? Object.values(err.fieldErrors ?? {}).find((message) => message.length > 0) : null;
        setError(
          (field ? formErrorMessage(tFormErrors, field) : null) ?? localizeApiError(err, tApiErrors, t("edit.error")),
        );
      }
      router.refresh();
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="control-md"
        className="px-3"
        onClick={() => {
          setError(null);
          setQuantities({});
          setOpen(true);
        }}
      >
        {t("edit.linesOpen")}
      </Button>
      <DashboardDialog
        open={open}
        onOpenChange={setOpen}
        title={t("edit.linesTitle", { number: order.orderNumber })}
        subtitle={t("edit.linesSubtitle")}
        submitLabel={t("edit.linesSubmit")}
        blocked={changed.length === 0 || left === 0}
        pending={pending}
        onSubmit={submit}
        preview={
          left === 0
            ? t("edit.linesEmpty")
            : changed.length > 0
              ? t("edit.linesPreview", {
                  count: units,
                  countFormatted: formatNumber(units, locale),
                  amount: formatMoney(amount, locale),
                })
              : undefined
        }
        previewTone={left === 0 ? "warning" : "neutral"}
        error={error}
      >
        {order.items.map((item) => {
          const lowerable = canLowerOrderItem(item);
          const quantity = quantityOf(item.id, item.quantity);
          return (
            <div key={item.id} className="flex flex-col gap-1 border-b border-border pb-4 last:border-b-0 last:pb-0">
              <div className="grid grid-cols-[minmax(0,1fr)_8rem] items-center gap-3">
                <span dir="auto" className={cn(FIELD_LABEL, "[overflow-wrap:anywhere]")}>
                  {item.name}
                </span>
                <Select
                  size="control-md"
                  aria-label={t("edit.quantityAria", { name: item.name })}
                  value={String(quantity)}
                  disabled={!lowerable || pending}
                  onChange={(event) => setQuantities({ ...quantities, [item.id]: Number(event.target.value) })}
                >
                  {Array.from({ length: item.quantity + 1 }, (_, value) => (
                    <option key={value} value={value}>
                      {value === 0 ? t("edit.remove") : formatNumber(value, locale)}
                    </option>
                  ))}
                </Select>
              </div>
              <OrderItemOptions options={item.options} className={FIELD_HINT} />
              {lowerable ? null : <p className={FIELD_HINT}>{t("edit.lineServed")}</p>}
              {item.note ? (
                <p dir="auto" className={cn(FIELD_HINT, "[overflow-wrap:anywhere]")}>
                  {item.note}
                </p>
              ) : null}
            </div>
          );
        })}
      </DashboardDialog>
    </>
  );
}
