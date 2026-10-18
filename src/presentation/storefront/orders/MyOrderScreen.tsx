import { ChevronLeft } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { canServeItems, isActiveOrder, isGuestCancellable, type Order } from "@/src/domain/entities/Order";
import type { PaymentOutcome } from "@/src/domain/entities/PaymentAttempt";
import { Link } from "@/src/i18n/navigation";
import { formatMoney } from "@/src/lib/formatMoney";
import { formatNumber } from "@/src/lib/formatNumber";
import { formatOrderDate } from "@/src/lib/formatOrderDate";
import { AutoRefresh } from "@/src/presentation/components/AutoRefresh";
import { OrderItemStateBadge } from "@/src/presentation/dashboard/orders/OrderItemStateBadge";
import { OrderServiceLabel } from "@/src/presentation/dashboard/orders/OrderServiceLabel";
import { Badge } from "@/src/presentation/design-system/components/Badge/Badge";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";
import { OrderTotals } from "@/src/presentation/orders/OrderTotals";

import { CancelMyOrderButton } from "./CancelMyOrderButton";
import { OrderProgress } from "./OrderProgress";
import { PaymentOutcomeNotice } from "./PaymentOutcomeNotice";
import { PayOnlineButton } from "./PayOnlineButton";

type MyOrderScreenProps = {
  order: Order;
  /** How the online payment went, when the guest just came back from the gateway. */
  paymentOutcome?: PaymentOutcome | "error";
};

/** Whether the guest can still pay the order online. */
function isPayableOnline(order: Order): boolean {
  return order.status !== "cancelled" && order.paymentStatus === "unpaid" && order.total > 0;
}

/**
 * The guest's order: number to listen for, progress, what they ordered and what it
 * cost, and — until it's paid — a way to pay online. While it's in the queue the
 * page re-reads itself, so "Ready" shows up without a reload.
 */
export async function MyOrderScreen({ order, paymentOutcome }: MyOrderScreenProps) {
  const t = await getTranslations("site");
  const tOrders = await getTranslations("dashOrders");
  const locale = await getLocale();
  const active = isActiveOrder(order.status);
  // Another request was still confirming the payment: re-read until it lands.
  const confirming = paymentOutcome === "processing" && order.paymentStatus === "unpaid";
  const outcome = paymentOutcome === "processing" && order.paymentStatus === "paid" ? "paid" : paymentOutcome;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      {active || confirming ? <AutoRefresh intervalSeconds={confirming ? 5 : 15} /> : null}
      {outcome ? <PaymentOutcomeNotice outcome={outcome} /> : null}

      <Link
        href="/orders"
        className="inline-flex w-fit items-center gap-1 text-body-small-strong text-muted-foreground hover:text-foreground"
      >
        <Icon icon={ChevronLeft} size="xs" className="rtl:-scale-x-100" />
        {t("orders.back")}
      </Link>

      <div className="rounded-card-lg bg-accent px-6 py-6 text-center">
        <p className="text-body-small text-muted-foreground">{t("orders.yourNumber")}</p>
        <p className="text-heading-page text-primary">#{formatNumber(order.orderNumber, locale)}</p>
        <p className="mt-1 text-body-small text-muted-foreground">{formatOrderDate(order.placedAt, locale)}</p>
      </div>

      {order.status === "cancelled" ? (
        <p className="rounded-card-md border border-border px-4 py-3 text-center text-body-small text-muted-foreground">
          {t("orders.cancelled")}
        </p>
      ) : (
        <>
          <OrderProgress status={order.status} />
          <p className="text-center text-body-default text-foreground">{t(`orders.statusLine.${order.status}`)}</p>
        </>
      )}

      <section className="rounded-card-lg border border-border p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <OrderServiceLabel order={order} />
          <Badge variant={order.paymentStatus === "paid" ? "success" : "neutral"}>
            {tOrders(`payment.${order.paymentStatus}`)}
          </Badge>
        </div>
        <ul className="mt-4 flex flex-col divide-y divide-border">
          {order.items.map((item) => (
            <li key={item.id} className="flex items-start justify-between gap-3 py-2.5">
              <div>
                <p className="text-body-small-strong text-foreground">
                  {formatNumber(item.quantity, locale)}× {item.name}
                </p>
                {item.note ? <p className="text-body-caption text-muted-foreground">{item.note}</p> : null}
                {canServeItems(order.status) ? (
                  <div className="mt-1">
                    <OrderItemStateBadge item={item} />
                  </div>
                ) : null}
              </div>
              <span className="text-body-small text-foreground">
                {formatMoney(item.unitPrice * item.quantity, locale)}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-3">
          <OrderTotals order={order} />
        </div>
        {order.note ? <p className="mt-3 text-body-small text-muted-foreground">{order.note}</p> : null}
      </section>

      {isPayableOnline(order) ? <PayOnlineButton orderId={order.id} /> : null}
      {isGuestCancellable(order.status) ? <CancelMyOrderButton orderId={order.id} /> : null}
    </div>
  );
}
