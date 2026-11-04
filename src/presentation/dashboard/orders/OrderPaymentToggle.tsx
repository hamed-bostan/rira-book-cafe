"use client";

import { ArrowLeftRight, Banknote, CreditCard, type LucideIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import * as React from "react";

import {
  COUNTER_PAYMENT_METHODS,
  type CounterPaymentMethod,
  type PaymentMethod,
  type PaymentPart,
  type PaymentStatus,
} from "@/src/domain/entities/Order";
import { useRouter } from "@/src/i18n/navigation";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { formatMoney } from "@/src/lib/formatMoney";
import { cn } from "@/src/lib/utils";
import { TEXT_ACTION } from "@/src/presentation/dashboard/fieldStyles";
import { Badge } from "@/src/presentation/design-system/components/Badge/Badge";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";
import { focusRing } from "@/src/presentation/design-system/components/shared/focusRing";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { ordersApi } from "./order-api";
import { splitParts, splitRemainder, type SplitAmounts } from "./paymentParts";
import { PaymentPartsFields } from "./PaymentPartsFields";

/** The ways staff may record a payment — never online, which only the gateway's callback books. */
const METHOD_ICON: Record<CounterPaymentMethod, LucideIcon> = {
  cash: Banknote,
  card: CreditCard,
  transfer: ArrowLeftRight,
};

type OrderPaymentToggleProps = {
  orderId: string;
  /** What the guest owes — what a split has to add up to. */
  total: number;
  paymentStatus: PaymentStatus;
  paymentMethod?: PaymentMethod;
  paymentParts?: readonly PaymentPart[];
  /** A cancelled order can't take a payment (a paid one shows as refunded). */
  cancelled: boolean;
  /** Part of the payment was refunded, so it can't be taken back. */
  refunded: boolean;
};

/**
 * Record a counter payment and how it was made — the method decides which account
 * the money lands in (till or bank), and a bill can be split between them. An online
 * payment is only ever booked by the gateway's callback, so it isn't offered. A
 * mistaken mark can be undone, which reverses it on the books. Writes, then refreshes
 * the server render.
 */
export function OrderPaymentToggle({
  orderId,
  total,
  paymentStatus,
  paymentMethod,
  paymentParts = [],
  cancelled,
  refunded,
}: OrderPaymentToggleProps) {
  const t = useTranslations("dashOrders");
  const tApiErrors = useTranslations("apiErrors");
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();
  const [choosing, setChoosing] = React.useState(false);
  const [splitting, setSplitting] = React.useState(false);
  const [amounts, setAmounts] = React.useState<SplitAmounts>({});
  /** The button that was clicked — only it shows the spinner; the rest just disable. */
  const [active, setActive] = React.useState<PaymentMethod | "split" | "unpaid" | null>(null);
  const [pending, startTransition] = React.useTransition();

  const parts = splitParts(amounts);

  function save(values: Parameters<typeof ordersApi.setPayment>[1], clicked: PaymentMethod | "split" | "unpaid"): void {
    setActive(clicked);
    startTransition(async () => {
      try {
        await ordersApi.setPayment(orderId, values);
        setChoosing(false);
        setSplitting(false);
        setAmounts({});
        router.refresh();
      } catch (err) {
        toast({ tone: "error", title: localizeApiError(err, tApiErrors, t("paymentError")) });
        // A 409 says someone changed the order meanwhile — show what it is now.
        router.refresh();
      }
    });
  }

  if (paymentStatus === "refunded") {
    return <p className="text-pretty text-foreground/80">{t("refundedNote")}</p>;
  }

  const paidLabel =
    paymentParts.length > 1
      ? t("paidWith", {
          method: paymentParts
            .map((part) => `${t(`paymentMethod.${part.method}`)} ${formatMoney(part.amount, locale)}`)
            .join(" + "),
        })
      : paymentMethod
        ? t("paidWith", { method: t(`paymentMethod.${paymentMethod}`) })
        : t("payment.paid");

  return (
    <div className="flex flex-col gap-3">
      {paymentStatus === "paid" ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <Badge variant="success" appearance="outline" dot size="compact" className="h-auto min-h-6 whitespace-normal">
            {paidLabel}
          </Badge>
          {refunded || paymentMethod === "online" ? null : (
            <button
              type="button"
              aria-busy={pending && active === "unpaid"}
              disabled={pending}
              onClick={() => save({ paymentStatus: "unpaid" }, "unpaid")}
              className={cn(TEXT_ACTION, focusRing, "text-primary hover:text-primary-hover")}
            >
              {t("unmarkPaid")}
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <span className="text-muted-foreground">{t("payment.unpaid")}</span>
          {!cancelled && !choosing ? (
            <Button
              type="button"
              variant="secondary"
              size="control-sm"
              className="px-3"
              disabled={pending}
              onClick={() => setChoosing(true)}
            >
              {t("markPaid")}
            </Button>
          ) : null}
        </div>
      )}

      {choosing && paymentStatus === "unpaid" ? (
        <>
          <span className="text-foreground/80">{t("paymentMethodLabel")}</span>
          {splitting ? (
            <>
              <PaymentPartsFields total={total} amounts={amounts} onChange={setAmounts} disabled={pending} />
              <Button
                type="button"
                variant="secondary"
                size="control-md"
                className="px-3"
                loading={pending && active === "split"}
                disabled={pending || splitRemainder(parts, total) !== 0 || parts.length === 0}
                onClick={() => save({ paymentStatus: "paid", paymentParts: parts }, "split")}
              >
                {t("recordPayment")}
              </Button>
            </>
          ) : (
            <div role="group" aria-label={t("paymentMethodLabel")} className="grid grid-cols-2 gap-2">
              {COUNTER_PAYMENT_METHODS.map((method) => (
                <Button
                  key={method}
                  type="button"
                  variant="secondary"
                  size="control-md"
                  // Two to a row; an odd one out takes the whole row.
                  className="px-3 last:odd:col-span-2"
                  loading={pending && active === method}
                  disabled={pending}
                  onClick={() => save({ paymentStatus: "paid", paymentMethod: method }, method)}
                >
                  {pending && active === method ? null : (
                    <Icon icon={METHOD_ICON[method]} size="icon-md" className="me-2" />
                  )}
                  {t(`paymentMethod.${method}`)}
                </Button>
              ))}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-x-4">
            <button
              type="button"
              disabled={pending}
              onClick={() => setSplitting(!splitting)}
              className={cn(TEXT_ACTION, focusRing, "w-fit text-primary hover:text-primary-hover")}
            >
              {splitting ? t("oneMethod") : t("splitPayment")}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setChoosing(false);
                setSplitting(false);
              }}
              className={cn(TEXT_ACTION, focusRing, "w-fit text-muted-foreground hover:text-foreground")}
            >
              {t("cancelChoice")}
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
