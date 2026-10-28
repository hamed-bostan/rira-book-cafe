import { useLocale, useTranslations } from "next-intl";

import { canServeItems, orderItemCount, servedLineCount, type Order } from "@/src/domain/entities/Order";
import { Link } from "@/src/i18n/navigation";
import { formatMoney } from "@/src/lib/formatMoney";
import { formatOrderTime } from "@/src/lib/formatOrderDate";
import { Badge } from "@/src/presentation/design-system/components/Badge/Badge";

import { OrderRowActions } from "./OrderRowActions";
import { OrderServiceLabel } from "./OrderServiceLabel";
import { OrderStatusBadge } from "./OrderStatusBadge";

type OrderCardProps = {
  order: Order;
  /** Draws the row menu — it writes, so it needs `orders.fulfill`. */
  canFulfill: boolean;
};

/**
 * One order as a card, for narrow screens — a phone at the counter. The whole card
 * opens the order: the order number is the link, stretched over the card (its ring
 * drawn where the card's own would be), so it stays one keyboard stop and a real
 * link. The table row's "⋯" menu sits above the stretched area, after the link in
 * the tab order; a button can't live inside a link, so the card itself is a plain box.
 */
export function OrderCard({ order, canFulfill }: OrderCardProps) {
  const t = useTranslations("dashOrders");
  const locale = useLocale();

  return (
    <div className="relative flex flex-col gap-3 rounded-card-md border border-border bg-background p-4 transition-colors hover:bg-muted">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-body-strong text-foreground">
            <Link
              href={`/dashboard/orders/${order.id}`}
              aria-label={t("viewOrderAria", { number: order.orderNumber })}
              className="after:absolute after:-inset-px after:rounded-card-md focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring focus-visible:after:ring-offset-2 focus-visible:after:ring-offset-background"
            >
              #{order.orderNumber}
            </Link>
          </p>
          <p className="truncate text-body-default text-muted-foreground sm:text-body-small">{order.customerName}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <OrderStatusBadge status={order.status} size="compact" />
          {canFulfill ? (
            // Above the stretched link. The negative margins let the 44px (32px from
            // `sm`) target reach into the card's padding without growing the line
            // past the badge, so the badge stays level with the order number.
            <div className="relative z-10 -my-2.5 -me-2.5 sm:-my-1 sm:-me-1">
              {/* Only what the menu reads — the rest of the order stays on the server. */}
              <OrderRowActions
                order={{
                  id: order.id,
                  orderNumber: order.orderNumber,
                  status: order.status,
                  paymentStatus: order.paymentStatus,
                }}
              />
            </div>
          ) : null}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <OrderServiceLabel order={order} />
        <span className="text-body-default text-muted-foreground sm:text-body-small">
          {t("itemCount", { count: orderItemCount(order) })}
          {canServeItems(order.status) ? ` (${t("servedProgress", servedLineCount(order))})` : null} ·{" "}
          {formatOrderTime(order.placedAt, locale)}
        </span>
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
        <span className="text-body-emphasis text-foreground tabular-nums sm:text-body-small-emphasis">
          {formatMoney(order.total, locale)}
        </span>
        <Badge variant={order.paymentStatus === "paid" ? "success" : "neutral"} size="compact">
          {t(`payment.${order.paymentStatus}`)}
        </Badge>
      </div>
    </div>
  );
}
