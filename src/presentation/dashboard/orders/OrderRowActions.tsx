"use client";

import { CircleCheck, CircleX, CreditCard, Eye, MoreHorizontal, Play } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import {
  PAYMENT_METHODS,
  canMarkPaid,
  isStaffCancellable,
  nextOrderStatus,
  type Order,
  type OrderStatus,
  type PaymentMethod,
} from "@/src/domain/entities/Order";
import { useRouter } from "@/src/i18n/navigation";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { DashboardDialog } from "@/src/presentation/dashboard/DashboardDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuIconTrigger,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/src/presentation/design-system/components/DropdownMenu/DropdownMenu";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { ordersApi } from "./order-api";

type OrderRowActionsProps = {
  order: Pick<Order, "id" | "orderNumber" | "status" | "paymentStatus">;
};

/**
 * One order's commands behind a "⋯" trigger: open it, take the next step, record
 * the payment, or cancel it (after a confirmation — it can't be undone). Only what
 * the order's state allows is listed — the same rules the detail screen and the
 * API use.
 *
 * Each action writes over the REST API, then `router.refresh()` re-runs the server
 * render. A 409 (someone else moved it first) shows as a toast — or in the cancel
 * dialog — and the refresh brings the real state.
 */
export function OrderRowActions({ order }: OrderRowActionsProps) {
  const t = useTranslations("dashOrders");
  const tApiErrors = useTranslations("apiErrors");
  const router = useRouter();
  const { toast } = useToast();
  const [confirmCancel, setConfirmCancel] = React.useState(false);
  const [cancelError, setCancelError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const next = nextOrderStatus(order.status);
  const payable = canMarkPaid(order);
  const cancellable = isStaffCancellable(order.status);

  function advance(to: OrderStatus): void {
    startTransition(async () => {
      try {
        await ordersApi.changeStatus(order.id, { status: to });
        toast({ tone: "success", title: t("movedToast", { number: order.orderNumber, status: to }) });
      } catch (err) {
        toast({ tone: "error", title: localizeApiError(err, tApiErrors, t("statusError")) });
      }
      router.refresh();
    });
  }

  function cancel(): void {
    setCancelError(null);
    startTransition(async () => {
      try {
        await ordersApi.changeStatus(order.id, { status: "cancelled" });
        toast({ tone: "success", title: t("cancelledToast", { number: order.orderNumber }) });
        setConfirmCancel(false);
      } catch (err) {
        setCancelError(localizeApiError(err, tApiErrors, t("statusError")));
      }
      router.refresh();
    });
  }

  function markPaid(paymentMethod: PaymentMethod): void {
    startTransition(async () => {
      try {
        await ordersApi.setPayment(order.id, { paymentStatus: "paid", paymentMethod });
        toast({ tone: "success", title: t("paidToast", { number: order.orderNumber }) });
      } catch (err) {
        toast({ tone: "error", title: localizeApiError(err, tApiErrors, t("paymentError")) });
      }
      router.refresh();
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuIconTrigger
          disabled={pending}
          // The dense table's borderless "⋯", as the Orders design draws it: 44px to
          // the touch on a phone, 32px from `sm`.
          className="size-11 text-muted-foreground hover:bg-muted hover:text-foreground sm:size-8"
          aria-label={t("rowActionsAria", { number: order.orderNumber })}
        >
          <Icon icon={MoreHorizontal} size="icon-md" />
        </DropdownMenuIconTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onSelect={() => router.push(`/dashboard/orders/${order.id}`)}>
            <Icon icon={Eye} size="icon-md" />
            {t("viewDetails")}
          </DropdownMenuItem>
          {next ? (
            <DropdownMenuItem onSelect={() => advance(next)}>
              <Icon icon={next === "preparing" ? Play : CircleCheck} size="icon-md" />
              {t(`advance.${next}`)}
            </DropdownMenuItem>
          ) : null}
          {payable ? (
            // The method decides which account the money lands in, so marking
            // paid is a choice of method rather than a bare toggle.
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Icon icon={CreditCard} size="icon-md" />
                {t("markAsPaid")}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {PAYMENT_METHODS.map((method) => (
                  <DropdownMenuItem key={method} onSelect={() => markPaid(method)}>
                    {t(`paymentMethod.${method}`)}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          ) : null}
          {cancellable ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                destructive
                onSelect={() => {
                  setCancelError(null);
                  setConfirmCancel(true);
                }}
              >
                <Icon icon={CircleX} size="icon-md" />
                {t("cancelOrder")}
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <DashboardDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title={t("cancelTitle", { number: order.orderNumber })}
        subtitle={t("cancelMessage")}
        submitLabel={t("cancelConfirm")}
        pending={pending}
        onSubmit={cancel}
        error={cancelError}
        danger
      />
    </>
  );
}
