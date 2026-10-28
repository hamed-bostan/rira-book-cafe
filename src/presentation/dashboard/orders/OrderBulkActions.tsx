"use client";

import { ChevronDown } from "lucide-react";
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
import { DashboardDialog } from "@/src/presentation/dashboard/DashboardDialog";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/src/presentation/design-system/components/DropdownMenu/DropdownMenu";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { ordersApi } from "./order-api";

/** The bar's buttons: the redesign's quiet bordered button, 40px tall from `sm` like the toolbar it replaces. */
const ACTION = "px-4 sm:min-h-10";

type OrderBulkActionsProps = {
  /** The page's orders — enough of each to tell which actions fit the selection. */
  orders: Pick<Order, "id" | "orderNumber" | "status" | "paymentStatus">[];
};

/**
 * The order list's bulk actions: serve, mark paid (with how the guests paid), and
 * cancel (after a confirmation — it can't be undone). A selection is usually mixed,
 * so each action applies to the orders it fits — the label says how many when that
 * isn't all of them, and an action that fits none is disabled. The server re-checks
 * every order and reports how many it actually changed.
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
  const [cancelError, setCancelError] = React.useState<string | null>(null);

  const selectedOrders = orders.filter((order) => selected.includes(order.id));

  function fittingOrders(type: BulkOrderActionType): typeof orders {
    return selectedOrders.filter((order) => canApplyBulkOrderAction(order, type));
  }

  /** "Mark served" when it fits every selected order, "Mark served (2)" when it fits some. */
  function labelFor(label: string, count: number): string {
    return count > 0 && count < selectedOrders.length ? t("bulkActionCount", { action: label, count }) : label;
  }

  /**
   * "3 orders marked as served" — or, when the one order it fitted is the one that
   * changed, that order by number, as a row action would say it.
   */
  function doneMessage(type: BulkOrderActionType, updated: number): string {
    if (updated === 0) return t("bulkNone");
    const fitted = fittingOrders(type);
    const number = updated === 1 && fitted.length === 1 ? fitted[0].orderNumber : null;
    switch (type) {
      case "serve":
        return number === null
          ? t("bulkServedToast", { count: updated })
          : t("movedToast", { number, status: "completed" });
      case "markPaid":
        return number === null ? t("bulkPaidToast", { count: updated }) : t("paidToast", { number });
      case "cancel":
        return number === null ? t("bulkCancelledToast", { count: updated }) : t("cancelledToast", { number });
    }
  }

  function apply(action: OrderBulkAction): void {
    setActive(action.type);
    setCancelError(null);
    startTransition(async () => {
      try {
        const { updated } = await ordersApi.bulkUpdate(selected, action);
        toast({ tone: "success", title: doneMessage(action.type, updated) });
        setConfirmCancel(false);
        router.refresh();
        clear();
      } catch (err) {
        const message = localizeApiError(err, tApiErrors, t("bulkError"));
        // A cancel is confirmed in a dialog, so its failure is said there.
        if (action.type === "cancel") setCancelError(message);
        else toast({ tone: "error", title: message });
      }
    });
  }

  const serveCount = fittingOrders("serve").length;
  const payCount = fittingOrders("markPaid").length;
  const cancelCount = fittingOrders("cancel").length;

  return (
    <>
      <Button
        variant="secondary"
        size="control-md"
        className={ACTION}
        loading={pending && active === "serve"}
        disabled={pending || serveCount === 0}
        onClick={() => apply({ type: "serve" })}
      >
        {labelFor(t("bulkServe"), serveCount)}
      </Button>

      {/* How the guests paid decides which account the money lands in, so this
          one opens a choice of method rather than acting straight away. */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild disabled={pending || payCount === 0}>
          <Button variant="secondary" size="control-md" className={ACTION} loading={pending && active === "markPaid"}>
            {labelFor(t("markPaid"), payCount)}
            <Icon icon={ChevronDown} size="icon-md" className="ms-1.5" />
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
        variant="secondary"
        size="control-md"
        className={`${ACTION} border-error-border text-error-foreground hover:bg-error active:bg-error disabled:text-error-foreground`}
        disabled={pending || cancelCount === 0}
        onClick={() => {
          setCancelError(null);
          setConfirmCancel(true);
        }}
      >
        {labelFor(t("bulkCancel"), cancelCount)}
      </Button>

      <DashboardDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title={t("bulkCancelTitle", { count: cancelCount })}
        subtitle={t("bulkCancelMessage")}
        submitLabel={t("bulkCancel")}
        pending={pending && active === "cancel"}
        onSubmit={() => apply({ type: "cancel" })}
        error={cancelError}
        danger
      />
    </>
  );
}
