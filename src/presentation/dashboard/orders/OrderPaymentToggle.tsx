"use client";

import { useTranslations } from "next-intl";
import * as React from "react";

import type { PaymentStatus } from "@/src/domain/entities/Order";
import { useRouter } from "@/src/i18n/navigation";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { FormMessage, Switch } from "@/src/presentation/design-system";

import { ordersApi } from "./order-api";

type OrderPaymentToggleProps = {
  orderId: string;
  paymentStatus: PaymentStatus;
};

/** "Paid" switch for counter payments. Writes, then refreshes the server render. */
export function OrderPaymentToggle({ orderId, paymentStatus }: OrderPaymentToggleProps) {
  const t = useTranslations("dashOrders");
  const tApiErrors = useTranslations("apiErrors");
  const router = useRouter();
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function onChange(paid: boolean): void {
    setError(null);
    startTransition(async () => {
      try {
        await ordersApi.setPayment(orderId, { paymentStatus: paid ? "paid" : "unpaid" });
        router.refresh();
      } catch (err) {
        setError(localizeApiError(err, tApiErrors, t("paymentError")));
      }
    });
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor="order-paid" className="text-body-small-emphasis text-foreground">
          {t("paidLabel")}
        </label>
        <Switch
          id="order-paid"
          checked={paymentStatus === "paid"}
          onCheckedChange={onChange}
          disabled={pending}
          aria-label={t("paidLabel")}
        />
      </div>
      {error ? <FormMessage>{error}</FormMessage> : null}
    </div>
  );
}
