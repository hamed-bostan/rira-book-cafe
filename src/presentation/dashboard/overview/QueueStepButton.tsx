"use client";

import { useTranslations } from "next-intl";
import * as React from "react";

import { nextOrderStatus, type OrderStatus } from "@/src/domain/entities/Order";
import { useRouter } from "@/src/i18n/navigation";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { ordersApi } from "@/src/presentation/dashboard/orders/order-api";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

type QueueStepButtonProps = {
  orderId: string;
  orderNumber: number;
  status: OrderStatus;
};

/**
 * The queue row's one action: the order's next step ("Start preparing", then
 * "Mark served"). Writes over the REST API, then `router.refresh()`es so the
 * queue re-reads; a 409 (someone moved it first) toasts and the refresh shows
 * where it really is.
 */
export function QueueStepButton({ orderId, orderNumber, status }: QueueStepButtonProps) {
  const t = useTranslations("dashOrders");
  const tApiErrors = useTranslations("apiErrors");
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = React.useTransition();

  const next = nextOrderStatus(status);
  if (!next) return null;

  function advance(to: OrderStatus): void {
    startTransition(async () => {
      try {
        await ordersApi.changeStatus(orderId, { status: to });
        toast({ tone: "success", title: t("statusChanged", { number: orderNumber, status: t(`status.${to}`) }) });
      } catch (err) {
        toast({ tone: "error", title: localizeApiError(err, tApiErrors, t("statusError")) });
      }
      router.refresh();
    });
  }

  return (
    <Button
      type="button"
      variant="secondary"
      size="control-md"
      loading={pending}
      onClick={() => advance(next)}
      className="ms-auto shrink-0 px-3"
    >
      {t(`advance.${next}`)}
    </Button>
  );
}
