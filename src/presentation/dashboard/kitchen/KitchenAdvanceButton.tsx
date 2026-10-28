"use client";

import { Check, Play } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import { nextOrderStatus, type OrderStatus } from "@/src/domain/entities/Order";
import { useRouter } from "@/src/i18n/navigation";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { cn } from "@/src/lib/utils";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { ordersApi } from "../orders/order-api";

type KitchenAdvanceButtonProps = {
  orderId: string;
  /** The order's number in the reader's digits, for the toast ("#229 served"). */
  number: string;
  status: OrderStatus;
  /** Every line ticked off — "Mark served" turns primary once nothing is left to make. */
  allReady: boolean;
};

/**
 * The ticket's one big button: move the order to its next step — "Start making"
 * takes a new order, "Mark served" hands one over (and marks any lines still
 * unticked). Cancelling stays on the order's own page. No undo: the workflow only
 * moves forward. A 409 (someone else moved it first) shows as a toast and the
 * refresh brings the real state.
 */
export function KitchenAdvanceButton({ orderId, number, status, allReady }: KitchenAdvanceButtonProps) {
  const t = useTranslations("dashKitchen");
  const tOrders = useTranslations("dashOrders");
  const tApiErrors = useTranslations("apiErrors");
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = React.useTransition();
  const next = nextOrderStatus(status);
  if (!next) return null;

  const serving = next === "completed";
  const primary = !serving || allReady;

  function advance(to: OrderStatus): void {
    startTransition(async () => {
      try {
        await ordersApi.changeStatus(orderId, { status: to });
        toast({ tone: "success", title: t(serving ? "servedToast" : "movedToast", { number }) });
      } catch (err) {
        toast({ tone: "error", title: localizeApiError(err, tApiErrors, tOrders("statusError")) });
      }
      router.refresh();
    });
  }

  return (
    <Button
      type="button"
      size="lg"
      variant={primary ? "primary" : "secondary"}
      // The quiet "Mark served" keeps a stronger hairline and an ink icon, as the design draws it.
      className={cn("w-full whitespace-nowrap", !primary && "border-border-strong [&_svg]:text-current")}
      loading={pending}
      onClick={() => advance(next)}
    >
      {pending ? null : <Icon icon={serving ? Check : Play} size="icon-md" strokeWidth={2} className="me-2" />}
      {t(serving ? "markServed" : "startMaking")}
    </Button>
  );
}
