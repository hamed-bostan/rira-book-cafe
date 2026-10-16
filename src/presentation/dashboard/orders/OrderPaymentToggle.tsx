"use client";

import { useTranslations } from "next-intl";
import * as React from "react";

import { PAYMENT_METHODS, type PaymentMethod, type PaymentStatus } from "@/src/domain/entities/Order";
import { useRouter } from "@/src/i18n/navigation";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { Button, FormMessage } from "@/src/presentation/design-system";

import { ordersApi } from "./order-api";

type OrderPaymentToggleProps = {
  orderId: string;
  paymentStatus: PaymentStatus;
  paymentMethod?: PaymentMethod;
  /** A cancelled order can't take a payment (a paid one shows as refunded). */
  cancelled: boolean;
};

/**
 * Record a counter payment and how it was made — the method decides which account
 * the money lands in (till, bank, gateway). A mistaken mark can be undone, which
 * reverses it on the books. Writes, then refreshes the server render.
 */
export function OrderPaymentToggle({ orderId, paymentStatus, paymentMethod, cancelled }: OrderPaymentToggleProps) {
  const t = useTranslations("dashOrders");
  const tApiErrors = useTranslations("apiErrors");
  const router = useRouter();
  const [choosing, setChoosing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function save(values: { paymentStatus: "paid"; paymentMethod: PaymentMethod } | { paymentStatus: "unpaid" }): void {
    setError(null);
    startTransition(async () => {
      try {
        await ordersApi.setPayment(orderId, values);
        setChoosing(false);
        router.refresh();
      } catch (err) {
        setError(localizeApiError(err, tApiErrors, t("paymentError")));
      }
    });
  }

  if (paymentStatus === "refunded") {
    return <p className="text-body-small text-foreground">{t("refundedNote")}</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {paymentStatus === "paid" ? (
        <div className="flex items-center justify-between gap-3">
          <span className="text-body-small-emphasis text-foreground">
            {paymentMethod ? t("paidWith", { method: t(`paymentMethod.${paymentMethod}`) }) : t("payment.paid")}
          </span>
          <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => save({ paymentStatus: "unpaid" })}>
            {t("unmarkPaid")}
          </Button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <span className="text-body-small-emphasis text-foreground">{t("payment.unpaid")}</span>
          {!cancelled && !choosing ? (
            <Button type="button" size="sm" disabled={pending} onClick={() => setChoosing(true)}>
              {t("markPaid")}
            </Button>
          ) : null}
        </div>
      )}

      {choosing && paymentStatus === "unpaid" ? (
        <div role="group" aria-label={t("paymentMethodLabel")} className="flex flex-col gap-2">
          <p className="text-body-caption text-muted-foreground">{t("paymentMethodLabel")}</p>
          <div className="grid grid-cols-2 gap-2">
            {PAYMENT_METHODS.map((method) => (
              <Button key={method} type="button" size="sm" variant="outline" disabled={pending} onClick={() => save({ paymentStatus: "paid", paymentMethod: method })}>
                {t(`paymentMethod.${method}`)}
              </Button>
            ))}
          </div>
          <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => setChoosing(false)}>
            {t("cancelChoice")}
          </Button>
        </div>
      ) : null}

      {error ? <FormMessage>{error}</FormMessage> : null}
    </div>
  );
}
