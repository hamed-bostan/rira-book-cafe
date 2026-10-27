"use client";

import { ChevronDown, CircleCheck, CircleX, CreditCard } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import type { OrderBulkAction } from "@/src/contracts/bulk-action-schema";
import {
  PAYMENT_METHODS,
  canApplyBulkOrderAction,
  type BulkOrderActionType,
  type Order,
} from "@/src/domain/entities/Order";
import { useRouter } from "@/src/i18n/navigation";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { useBulkSelection } from "@/src/presentation/dashboard/bulk";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/src/presentation/design-system/components/DropdownMenu/DropdownMenu";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";
import { ConfirmSheet } from "@/src/presentation/design-system/components/Sheet/ConfirmSheet";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { ordersApi } from "./order-api";

type OrderBulkActionsProps = {
  /** The page's orders — enough of each to tell which actions fit the selection. */
  orders: Pick<Order, "id" | "status" | "paymentStatus">[];
};

/**
 * The order list's bulk actions: serve, mark paid (with how the guests paid), and
 * cancel. A selection is usually mixed, so each action applies to the orders it
 * fits — the label says how many when that isn't all of them, and an action that
 * fits none is disabled. The server re-checks every order and reports how many it
 * actually changed.
 *
 * Writes over the API, then `router.refresh()`es, so the rows come back from the
 * server rather than being patched locally. Reads the selection from context (see
 * `BulkActionBar`).
 */
export function OrderBulkActions({ orders }: OrderBulkActionsProps) {
  const t = useTranslations("dashOrders");
  const tApiErrors = useTranslations("apiErrors");
  const router = useRouter();
  const { toast } = useToast();
  const { selected, clear } = useBulkSelection();
  const [pending, startTransition] = React.useTransition();
  /** The action in flight — only its button shows the spinner; the rest just disable. */
  const [active, setActive] = React.useState<BulkOrderActionType | null>(null);
  const [confirmCancel, setConfirmCancel] = React.useState(false);

  const selectedOrders = orders.filter((order) => selected.includes(order.id));

  function fitting(type: BulkOrderActionType): number {
    return selectedOrders.filter((order) => canApplyBulkOrderAction(order, type)).length;
  }

  /** "Mark served" when it fits every selected order, "Mark served (2)" when it fits some. */
  function labelFor(label: string, count: number): string {
    return count > 0 && count < selectedOrders.length ? t("bulkActionCount", { action: label, count }) : label;
  }

  function apply(action: OrderBulkAction): void {
    setActive(action.type);
    startTransition(async () => {
      try {
        const { updated } = await ordersApi.bulkUpdate(selected, action);
        toast({ tone: "success", title: t("bulkDone", { count: updated }) });
        router.refresh();
        clear();
      } catch (err) {
        toast({ tone: "error", title: localizeApiError(err, tApiErrors, t("bulkError")) });
      }
    });
  }

  const serveCount = fitting("serve");
  const payCount = fitting("markPaid");
  const cancelCount = fitting("cancel");

  return (
    <>
      <Button
        variant="outline"
        size="control-md"
        loading={pending && active === "serve"}
        disabled={pending || serveCount === 0}
        onClick={() => apply({ type: "serve" })}
      >
        <Icon icon={CircleCheck} size="sm" className="me-1.5" />
        {labelFor(t("bulkServe"), serveCount)}
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild disabled={pending || payCount === 0}>
          <Button variant="outline" size="control-md" loading={pending && active === "markPaid"}>
            <Icon icon={CreditCard} size="sm" className="me-1.5" />
            {labelFor(t("markPaid"), payCount)}
            <Icon icon={ChevronDown} size="sm" className="ms-1.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" aria-label={t("paymentMethodLabel")}>
          {PAYMENT_METHODS.map((paymentMethod) => (
            <DropdownMenuItem key={paymentMethod} onSelect={() => apply({ type: "markPaid", paymentMethod })}>
              {t(`paymentMethod.${paymentMethod}`)}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Button
        variant="outline"
        size="control-md"
        className="border-error-foreground text-error-foreground hover:bg-error"
        loading={pending && active === "cancel"}
        disabled={pending || cancelCount === 0}
        onClick={() => setConfirmCancel(true)}
      >
        <Icon icon={CircleX} size="sm" className="me-1.5" />
        {labelFor(t("bulkCancel"), cancelCount)}
      </Button>

      <ConfirmSheet
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title={t("bulkCancelTitle", { count: cancelCount })}
        message={t("bulkCancelMessage")}
        confirmLabel={t("bulkCancel")}
        cancelLabel={t("cancelKeep")}
        onConfirm={() => {
          setConfirmCancel(false);
          apply({ type: "cancel" });
        }}
      />
    </>
  );
}
