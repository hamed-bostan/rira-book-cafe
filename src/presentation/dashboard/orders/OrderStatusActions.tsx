"use client";

import { useTranslations } from "next-intl";
import * as React from "react";

import { isStaffCancellable, nextOrderStatus, type OrderStatus } from "@/src/domain/entities/Order";
import { useRouter } from "@/src/i18n/navigation";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { cn } from "@/src/lib/utils";
import { DashboardDialog } from "@/src/presentation/dashboard/DashboardDialog";
import { DANGER_SECONDARY } from "@/src/presentation/dashboard/fieldStyles";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

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
 * shows as a toast and the refresh brings the real state.
 */
export function OrderStatusActions({ orderId, orderNumber, status }: OrderStatusActionsProps) {
  const t = useTranslations("dashOrders");
  const tApiErrors = useTranslations("apiErrors");
  const router = useRouter();
  const { toast } = useToast();
  const [confirmCancel, setConfirmCancel] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  /** The step being written — only its button shows the spinner. */
  const [active, setActive] = React.useState<OrderStatus | null>(null);

  const next = nextOrderStatus(status);
  const cancellable = isStaffCancellable(status);

  function moveTo(to: OrderStatus): void {
    setActive(to);
    startTransition(async () => {
      try {
        await ordersApi.changeStatus(orderId, { status: to });
        toast({
          tone: "success",
          title:
            to === "cancelled"
              ? t("cancelledToast", { number: orderNumber })
              : t("statusChanged", { number: orderNumber, status: t(`status.${to}`) }),
        });
      } catch (err) {
        toast({ tone: "error", title: localizeApiError(err, tApiErrors, t("statusError")) });
      }
      router.refresh();
    });
  }

  if (!next && !cancellable) return null;

  return (
    <>
      {cancellable ? (
        <Button
          type="button"
          variant="secondary"
          size="control-md"
          className={cn("px-4", DANGER_SECONDARY)}
          onClick={() => setConfirmCancel(true)}
          loading={pending && active === "cancelled"}
          disabled={pending}
        >
          {t("cancelOrder")}
        </Button>
      ) : null}
      {next ? (
        <Button
          type="button"
          size="control-md"
          onClick={() => moveTo(next)}
          loading={pending && active === next}
          disabled={pending}
        >
          {t(`advance.${next}`)}
        </Button>
      ) : null}

      <DashboardDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title={t("cancelTitle", { number: orderNumber })}
        subtitle={t("cancelMessage")}
        submitLabel={t("cancelConfirm")}
        backLabel={t("cancelKeep")}
        pending={false}
        onSubmit={() => {
          setConfirmCancel(false);
          moveTo("cancelled");
        }}
        danger
      />
    </>
  );
}
