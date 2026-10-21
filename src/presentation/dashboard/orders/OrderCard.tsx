import { useLocale, useTranslations } from "next-intl";

import { canServeItems, orderItemCount, servedLineCount, type Order } from "@/src/domain/entities/Order";
import { Link } from "@/src/i18n/navigation";
import { formatMoney } from "@/src/lib/formatMoney";
import { formatOrderTime } from "@/src/lib/formatOrderDate";
import { cn } from "@/src/lib/utils";
import { Badge } from "@/src/presentation/design-system/components/Badge/Badge";
import { focusRing } from "@/src/presentation/design-system/components/shared/focusRing";

import { OrderServiceLabel } from "./OrderServiceLabel";
import { OrderStatusBadge } from "./OrderStatusBadge";

/**
 * One order as a card, for narrow screens — a phone at the counter. The whole card
 * is the link: unlike the table row it carries no other controls.
 */
export function OrderCard({ order }: { order: Order }) {
  const t = useTranslations("dashOrders");
  const locale = useLocale();

  return (
    <Link
      href={`/dashboard/orders/${order.id}`}
      aria-label={t("viewOrderAria", { number: order.orderNumber })}
      className={cn(
        "flex flex-col gap-3 rounded-card-md border border-border bg-background p-4 transition-colors hover:bg-muted",
        focusRing,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-body-strong text-foreground">#{order.orderNumber}</p>
          <p className="truncate text-body-default text-muted-foreground sm:text-body-small">{order.customerName}</p>
        </div>
        <OrderStatusBadge status={order.status} />
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
        <Badge variant={order.paymentStatus === "paid" ? "success" : "neutral"}>
          {t(`payment.${order.paymentStatus}`)}
        </Badge>
      </div>
    </Link>
  );
}
