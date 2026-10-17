"use client";

import { useTranslations } from "next-intl";
import * as React from "react";

import { nextOrderStatus, type OrderStatus } from "@/src/domain/entities/Order";
import { useRouter } from "@/src/i18n/navigation";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { Button, FormMessage } from "@/src/presentation/design-system";

import { ordersApi } from "../orders/order-api";

/**
 * The one button a station needs: move the order to its next step (accept →
 * start → ready → complete). Cancelling stays on the order's own page. A 409
 * (someone else moved it first) shows inline and the refresh brings the real state.
 */
export function KitchenAdvanceButton({ orderId, status }: { orderId: string; status: OrderStatus }) {
  const t = useTranslations("dashOrders");
  const tApiErrors = useTranslations("apiErrors");
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const next = nextOrderStatus(status);
  if (!next) return null;

  function advance(to: OrderStatus): void {
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

  return (
    <div className="flex flex-col gap-1">
      <Button type="button" className="w-full" disabled={pending} onClick={() => advance(next)}>
        {t(`advance.${next}`)}
      </Button>
      {error ? <FormMessage>{error}</FormMessage> : null}
    </div>
  );
}
