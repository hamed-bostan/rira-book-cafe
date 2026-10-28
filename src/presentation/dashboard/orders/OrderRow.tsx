import { useLocale, useTranslations } from "next-intl";

import { canServeItems, orderItemCount, servedLineCount, type Order } from "@/src/domain/entities/Order";
import { Link } from "@/src/i18n/navigation";
import { formatMoney } from "@/src/lib/formatMoney";
import { formatOrderDateShort, formatOrderTime } from "@/src/lib/formatOrderDate";
import { maskPhoneNumber } from "@/src/lib/maskPhoneNumber";
import { BulkRowCheckbox } from "@/src/presentation/dashboard/bulk";
import { Badge } from "@/src/presentation/design-system/components/Badge/Badge";
import { TableCell, TableRow } from "@/src/presentation/design-system/components/DataTable/DataTable";

import { OrderRowActions } from "./OrderRowActions";
import { OrderServiceLabel } from "./OrderServiceLabel";
import { OrderStatusBadge } from "./OrderStatusBadge";

type OrderRowProps = {
  order: Order;
  /** Draws the selection checkbox and the row menu — both write, so both need `orders.fulfill`. */
  canFulfill: boolean;
};

/**
 * One order in the desktop table. The whole row opens the order: the order number
 * is the link, stretched over the row, so it stays one keyboard stop and a real
 * link (open in a new tab, copy address) rather than a click handler on a `<tr>`.
 * The checkbox and the menu sit above the stretched area. A selected row is tinted
 * — read off its checkbox's state, so the row itself stays server-rendered.
 */
export function OrderRow({ order, canFulfill }: OrderRowProps) {
  const t = useTranslations("dashOrders");
  const locale = useLocale();

  return (
    <TableRow className="relative hover:bg-muted has-[[role=checkbox][data-state=checked]]:bg-accent">
      {canFulfill ? (
        <TableCell className="relative z-10 w-10 py-0 ps-2 pe-0">
          <label className="flex size-8 cursor-pointer items-center justify-center">
            <BulkRowCheckbox id={order.id} label={t("selectRowAria", { number: order.orderNumber })} />
          </label>
        </TableCell>
      ) : null}

      <TableCell>
        <Link
          href={`/dashboard/orders/${order.id}`}
          aria-label={t("viewOrderAria", { number: order.orderNumber })}
          className="text-body-small-strong text-primary tabular-nums after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring focus-visible:after:ring-inset"
        >
          #{order.orderNumber}
        </Link>
      </TableCell>

      <TableCell>
        <span className="block max-w-48 truncate text-body-small-emphasis text-foreground">{order.customerName}</span>
        {/* `dir="ltr"`: a phone number reads left-to-right even in an RTL row. */}
        <span dir="ltr" className="block truncate text-body-caption text-muted-foreground tabular-nums">
          {maskPhoneNumber(order.customerPhone)}
        </span>
      </TableCell>

      <TableCell>
        <OrderServiceLabel order={order} />
      </TableCell>

      <TableCell>
        <span className="block text-body-small whitespace-nowrap text-foreground">
          {t("itemCount", { count: orderItemCount(order) })}
        </span>
        {canServeItems(order.status) ? (
          <span className="block text-body-caption whitespace-nowrap text-muted-foreground">
            {t("servedProgress", servedLineCount(order))}
          </span>
        ) : null}
      </TableCell>

      <TableCell>
        <div className="flex flex-nowrap items-center gap-1.5">
          <OrderStatusBadge status={order.status} size="compact" />
          {order.paymentStatus === "paid" ? (
            <Badge variant="success" appearance="outline" dot size="compact">
              {t("payment.paid")}
            </Badge>
          ) : null}
        </div>
      </TableCell>

      <TableCell className="tabular-nums">
        <span className="block text-body-small whitespace-nowrap text-foreground">
          {formatOrderTime(order.placedAt, locale)}
        </span>
        <span className="block text-body-caption whitespace-nowrap text-muted-foreground">
          {formatOrderDateShort(order.placedAt, locale)}
        </span>
      </TableCell>

      <TableCell className="text-end text-body-small-strong whitespace-nowrap text-foreground tabular-nums">
        {formatMoney(order.total, locale)}
      </TableCell>

      {canFulfill ? (
        <TableCell className="relative z-10 w-12 py-0 ps-0 pe-2 text-end">
          {/* Only what the menu reads — the rest of the order stays on the server. */}
          <OrderRowActions
            order={{
              id: order.id,
              orderNumber: order.orderNumber,
              status: order.status,
              paymentStatus: order.paymentStatus,
            }}
          />
        </TableCell>
      ) : null}
    </TableRow>
  );
}
