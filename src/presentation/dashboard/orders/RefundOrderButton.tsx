"use client";

import { useLocale, useTranslations } from "next-intl";
import * as React from "react";

import { PAYMENT_METHODS, refundableQuantity, type Order, type PaymentMethod } from "@/src/domain/entities/Order";
import { MAX_REFUND_REASON_LENGTH, priceRefundLines } from "@/src/domain/entities/OrderRefund";
import { useRouter } from "@/src/i18n/navigation";
import { ApiError } from "@/src/lib/api/ApiError";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { formatMoney } from "@/src/lib/formatMoney";
import { formatNumber } from "@/src/lib/formatNumber";
import { formErrorMessage } from "@/src/lib/formErrorMessage";
import { cn } from "@/src/lib/utils";
import { DashboardField } from "@/src/presentation/dashboard/DashboardField";
import { DashboardSwitchField } from "@/src/presentation/dashboard/DashboardSwitchField";
import { DANGER_SECONDARY, FIELD_LABEL } from "@/src/presentation/dashboard/fieldStyles";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { Input } from "@/src/presentation/design-system/components/form/Input/Input";
import { Select } from "@/src/presentation/design-system/components/form/Select/Select";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { DashboardDialog } from "../DashboardDialog";

import { ordersApi } from "./order-api";

type RefundOrderButtonProps = {
  order: Pick<Order, "id" | "orderNumber" | "items" | "total" | "paymentMethod">;
};

/** What's picked for one line. Books go back on the shelf by default; a drink can't. */
type LinePick = { quantity: number; restock: boolean };

/**
 * Hand money back on a served order: how many of each line, whether they go back on
 * the shelf, and which way the money goes. The amount shown is worked out the way the
 * server will, so staff see it before they confirm.
 */
export function RefundOrderButton({ order }: RefundOrderButtonProps) {
  const t = useTranslations("dashOrders");
  const tApiErrors = useTranslations("apiErrors");
  const tFormErrors = useTranslations("formErrors");
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();

  const refundable = order.items.filter((item) => refundableQuantity(item) > 0);
  const [open, setOpen] = React.useState(false);
  const [picks, setPicks] = React.useState<Readonly<Record<string, LinePick>>>({});
  const [method, setMethod] = React.useState<PaymentMethod>(order.paymentMethod ?? "cash");
  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const pickFor = (id: string, kind: string): LinePick => picks[id] ?? { quantity: 0, restock: kind === "book" };
  const lines = refundable.flatMap((item) => {
    const pick = pickFor(item.id, item.kind);
    return pick.quantity > 0 ? [{ itemId: item.id, quantity: pick.quantity, restock: pick.restock }] : [];
  });
  const priced = lines.length > 0 ? priceRefundLines(order, 0, lines) : undefined;
  const amount = priced?.lines?.reduce((sum, line) => sum + line.amount, 0) ?? 0;

  function submit(): void {
    setError(null);
    startTransition(async () => {
      try {
        await ordersApi.refund(order.id, { lines, method, reason });
        toast({ tone: "success", title: t("refund.saved", { number: order.orderNumber }) });
        setOpen(false);
        setPicks({});
        setReason("");
        router.refresh();
      } catch (err) {
        const field =
          err instanceof ApiError ? Object.values(err.fieldErrors ?? {}).find((message) => message.length > 0) : null;
        setError(
          (field ? formErrorMessage(tFormErrors, field) : null) ?? localizeApiError(err, tApiErrors, t("refund.error")),
        );
      }
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="control-md"
        className={cn("px-3", DANGER_SECONDARY)}
        onClick={() => setOpen(true)}
      >
        {t("refund.open")}
      </Button>
      <DashboardDialog
        open={open}
        onOpenChange={setOpen}
        title={t("refund.title", { number: order.orderNumber })}
        subtitle={t("refund.subtitle")}
        submitLabel={t("refund.submit")}
        blocked={amount <= 0}
        pending={pending}
        onSubmit={submit}
        preview={amount > 0 ? t("refund.preview", { amount: formatMoney(amount, locale) }) : undefined}
        previewTone="warning"
        error={error}
        danger
      >
        <div className="flex flex-col gap-4">
          {refundable.map((item) => {
            const pick = pickFor(item.id, item.kind);
            const most = refundableQuantity(item);
            return (
              <div key={item.id} className="flex flex-col gap-2 border-b border-border pb-4 last:border-b-0 last:pb-0">
                <div className="grid grid-cols-[minmax(0,1fr)_5rem] items-center gap-3">
                  <span dir="auto" className={FIELD_LABEL}>
                    {item.name}
                  </span>
                  <Select
                    size="control-md"
                    aria-label={t("refund.quantityAria", { name: item.name })}
                    value={String(pick.quantity)}
                    onChange={(event) =>
                      setPicks({ ...picks, [item.id]: { ...pick, quantity: Number(event.target.value) } })
                    }
                  >
                    {Array.from({ length: most + 1 }, (_, quantity) => (
                      <option key={quantity} value={quantity}>
                        {formatNumber(quantity, locale)}
                      </option>
                    ))}
                  </Select>
                </div>
                {pick.quantity > 0 ? (
                  <DashboardSwitchField
                    label={t("refund.restock")}
                    checked={pick.restock}
                    onCheckedChange={(restock) => setPicks({ ...picks, [item.id]: { ...pick, restock } })}
                  />
                ) : null}
              </div>
            );
          })}
        </div>
        <DashboardField label={t("refund.methodLabel")}>
          <Select size="control-md" value={method} onChange={(event) => setMethod(event.target.value as PaymentMethod)}>
            {PAYMENT_METHODS.map((option) => (
              <option key={option} value={option}>
                {t(`paymentMethod.${option}`)}
              </option>
            ))}
          </Select>
        </DashboardField>
        <DashboardField label={t("refund.reasonLabel")}>
          <Input
            size="control-md"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={MAX_REFUND_REASON_LENGTH}
            autoComplete="off"
            dir="auto"
          />
        </DashboardField>
      </DashboardDialog>
    </>
  );
}
