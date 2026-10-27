"use client";

import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import { PAYMENT_METHODS, type PaymentMethod } from "@/src/domain/entities/Order";
import { useRouter } from "@/src/i18n/navigation";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { ordersApi } from "@/src/presentation/dashboard/orders/order-api";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/src/presentation/design-system/components/DropdownMenu/DropdownMenu";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

type MarkPaidButtonProps = {
  orderId: string;
  orderNumber: number;
  /** The id of the row title naming the order, so each "Mark paid" says which one. */
  describedBy: string;
};

/**
 * "Mark paid" on a served-but-unpaid order: the menu asks how it was paid — the
 * method decides which account the money lands in — and the toast offers to take
 * it back, which marks it unpaid again and reverses it on the books. Writes over
 * the orders API, then refreshes the report.
 */
export function MarkPaidButton({ orderId, orderNumber, describedBy }: MarkPaidButtonProps) {
  const t = useTranslations("dashReports.payments");
  const tOrders = useTranslations("dashOrders");
  const tApiErrors = useTranslations("apiErrors");
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = React.useTransition();

  function markPaid(method: PaymentMethod): void {
    startTransition(async () => {
      try {
        await ordersApi.setPayment(orderId, { paymentStatus: "paid", paymentMethod: method });
        toast({ tone: "success", title: t("markedPaid", { number: String(orderNumber) }), onUndo: markUnpaid });
      } catch (err) {
        toast({ tone: "error", title: localizeApiError(err, tApiErrors, t("markPaidError")) });
      }
      router.refresh();
    });
  }

  /** The undo: no undo of its own. */
  function markUnpaid(): void {
    startTransition(async () => {
      try {
        await ordersApi.setPayment(orderId, { paymentStatus: "unpaid" });
        toast({ tone: "success", title: t("markedUnpaid", { number: String(orderNumber) }) });
      } catch (err) {
        toast({ tone: "error", title: localizeApiError(err, tApiErrors, tOrders("paymentError")) });
      }
      router.refresh();
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={pending}>
        <Button
          type="button"
          variant="secondary"
          size="control-md"
          className="px-3"
          loading={pending}
          aria-describedby={describedBy}
        >
          {t("markPaid")}
          <Icon icon={ChevronDown} size="sm" className="ms-1.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" aria-label={tOrders("paymentMethodLabel")}>
        {PAYMENT_METHODS.map((method) => (
          <DropdownMenuItem key={method} onSelect={() => markPaid(method)}>
            {tOrders(`paymentMethod.${method}`)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
