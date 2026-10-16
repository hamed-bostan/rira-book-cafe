"use client";

import { useTranslations } from "next-intl";
import * as React from "react";

import { isStaffCancellable, nextOrderStatus, type OrderStatus } from "@/src/domain/entities/Order";
import { useRouter } from "@/src/i18n/navigation";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { Button, ConfirmSheet, FormMessage } from "@/src/presentation/design-system";

import { ordersApi } from "./order-api";

type OrderStatusActionsProps = {
  orderId: string;
  orderNumber: number;
  status: OrderStatus;
};

/**
 * The detail screen's workflow controls: one primary button for the next step
 * (Accept → Start preparing → Mark ready → Complete) and, while the order can still
 * be withdrawn, a cancel behind a confirmation. Each writes over the REST API, then
 * `router.refresh()` re-runs the server render. A 409 (someone else moved it first)
 * shows inline and the refresh brings the real state.
 */
export function OrderStatusActions({ orderId, orderNumber, status }: OrderStatusActionsProps) {
  const t = useTranslations("dashOrders");
  const tApiErrors = useTranslations("apiErrors");
  const router = useRouter();
  const [error, setError] = React.useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  const next = nextOrderStatus(status);
  const cancellable = isStaffCancellable(status);

  function moveTo(to: OrderStatus): void {
    setError(null);
    startTransition(async () => {
      try {
        await ordersApi.changeStatus(orderId, { status: to });
      } catch (err) {
        setError(localizeApiError(err, tApiErrors, t("statusError")));
      }
      router.refresh();
    });
  }

  if (!next && !cancellable) return null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {next ? (
          <Button type="button" onClick={() => moveTo(next)} disabled={pending}>
            {t(`advance.${next}`)}
          </Button>
        ) : null}
        {cancellable ? (
          <Button type="button" variant="outline" onClick={() => setConfirmCancel(true)} disabled={pending}>
            {t("cancelOrder")}
          </Button>
        ) : null}
      </div>
      {error ? <FormMessage>{error}</FormMessage> : null}

      <ConfirmSheet
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title={t("cancelTitle", { number: orderNumber })}
        message={t("cancelMessage")}
        confirmLabel={t("cancelConfirm")}
        cancelLabel={t("cancelKeep")}
        onConfirm={() => {
          setConfirmCancel(false);
          moveTo("cancelled");
        }}
      />
    </div>
  );
}
