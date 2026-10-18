import { useLocale, useTranslations } from "next-intl";

import { canServeItems, orderItemCount, servedLineCount, type Order } from "@/src/domain/entities/Order";
import { Link } from "@/src/i18n/navigation";
import { formatMoney } from "@/src/lib/formatMoney";
import { formatOrderDateShort, formatOrderTime } from "@/src/lib/formatOrderDate";
import { maskPhoneNumber } from "@/src/lib/maskPhoneNumber";
import { Badge } from "@/src/presentation/design-system/components/Badge/Badge";
import { TableCell, TableRow } from "@/src/presentation/design-system/components/DataTable/DataTable";

import { OrderServiceLabel } from "./OrderServiceLabel";
import { OrderStatusBadge } from "./OrderStatusBadge";

/** One order in the desktop table. The order number is the link to its detail screen. */
export function OrderRow({ order }: { order: Order }) {
  const t = useTranslations("dashOrders");
  const locale = useLocale();

  return (
    <TableRow className="[&>td]:py-4">
      <TableCell>
        <Link
          href={`/dashboard/orders/${order.id}`}
          aria-label={t("viewOrderAria", { number: order.orderNumber })}
          className="inline-block py-2 text-body-small-emphasis text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          #{order.orderNumber}
        </Link>
      </TableCell>

      <TableCell>
        <span className="block max-w-48 truncate text-body-small-emphasis text-foreground">{order.customerName}</span>
        {/* `dir="ltr"`: a phone number reads left-to-right even in an RTL row. */}
        <span dir="ltr" className="block truncate text-body-small-strong text-muted-foreground">
          {maskPhoneNumber(order.customerPhone)}
        </span>
      </TableCell>

      <TableCell>
        <OrderServiceLabel order={order} />
      </TableCell>

      <TableCell>
        <span className="block text-body-small text-muted-foreground">
          {t("itemCount", { count: orderItemCount(order) })}
        </span>
        {canServeItems(order.status) ? (
          <span className="block text-body-caption whitespace-nowrap text-muted-foreground">
            {t("servedProgress", servedLineCount(order))}
          </span>
        ) : null}
      </TableCell>

      <TableCell>
        <div className="flex flex-wrap items-center gap-1.5">
          <OrderStatusBadge status={order.status} />
          {order.paymentStatus === "paid" ? (
            <Badge variant="success" appearance="outline">
              {t("payment.paid")}
            </Badge>
          ) : null}
        </div>
      </TableCell>

      <TableCell>
        <span className="block text-body-small whitespace-nowrap text-foreground">
          {formatOrderTime(order.placedAt, locale)}
        </span>
        <span className="block text-body-small-strong whitespace-nowrap text-muted-foreground">
          {formatOrderDateShort(order.placedAt, locale)}
        </span>
      </TableCell>

      <TableCell className="text-end text-body-small-emphasis whitespace-nowrap text-foreground">
        {formatMoney(order.total, locale)}
      </TableCell>
    </TableRow>
  );
}
