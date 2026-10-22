import { getLocale, getTranslations } from "next-intl/server";

import { orderItemCount, type Order } from "@/src/domain/entities/Order";
import { Link } from "@/src/i18n/navigation";
import { formatNumber } from "@/src/lib/formatNumber";
import { cn } from "@/src/lib/utils";
import { OrderStatusBadge } from "@/src/presentation/dashboard/orders/OrderStatusBadge";

import { OverviewPanel, OverviewPanelRow } from "./OverviewPanel";
import { QueueStepButton } from "./QueueStepButton";
import { minutesWaiting, WAIT_LATE_MINUTES, WAIT_WARN_MINUTES } from "./waiting";

type OrderQueuePanelProps = {
  /** Orders still in the queue, oldest first — the one waiting longest leads. */
  orders: Order[];
  /** How many are in the queue in all, which can be more than the rows shown. */
  total: number;
  /** When the page was rendered (ISO), the clock the waits are measured against. */
  now: string;
  /** Draws each row's next-step button (`orders.fulfill`). */
  canFulfill: boolean;
};

/**
 * What the bar has to do next: every open order, the longest wait first, with how
 * long it has waited and the one button that moves it along. The wait turns amber
 * at {@link WAIT_WARN_MINUTES} and red at {@link WAIT_LATE_MINUTES}.
 */
export async function OrderQueuePanel({ orders, total, now, canFulfill }: OrderQueuePanelProps) {
  const t = await getTranslations("dashOverview");
  const tOrders = await getTranslations("dashOrders");
  const locale = await getLocale();

  return (
    <OverviewPanel
      id="overview-queue"
      title={t("queueHeading")}
      count={formatNumber(total, locale)}
      action={{ href: "/dashboard/orders?status=active", label: t("viewAll") }}
    >
      {orders.length === 0 ? (
        <div className="flex flex-col items-center gap-1 border-t border-border px-5 py-10 text-center">
          <p className="text-body-strong text-foreground sm:text-body-small-strong">{t("queueEmptyTitle")}</p>
          <p className="text-body-default text-muted-foreground sm:text-body-small">{t("queueEmptyBody")}</p>
        </div>
      ) : (
        orders.map((order) => {
          const minutes = minutesWaiting(order.placedAt, now);
          return (
            <OverviewPanelRow key={order.id}>
              <span className="flex w-20 shrink-0 flex-col whitespace-nowrap tabular-nums">
                <span
                  className={cn(
                    "text-body-strong sm:text-body-small-strong",
                    minutes >= WAIT_LATE_MINUTES
                      ? "text-error-foreground"
                      : minutes >= WAIT_WARN_MINUTES
                        ? "text-warning-foreground"
                        : "text-foreground",
                  )}
                >
                  {minutes < 60
                    ? t("waitMinutes", { minutes })
                    : t("waitHours", { hours: Math.floor(minutes / 60), minutes: minutes % 60 })}
                </span>
                <span className="text-body-small text-muted-foreground sm:text-body-caption">{t("waiting")}</span>
              </span>

              <span className="flex min-w-0 flex-[1_1_9rem] flex-col gap-0.5">
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <Link
                    href={`/dashboard/orders/${order.id}`}
                    className="text-body-strong text-primary tabular-nums hover:text-primary-hover sm:text-body-small-strong"
                  >
                    #{order.orderNumber}
                  </Link>
                  <span className="text-body-default whitespace-nowrap text-foreground sm:text-body-small">
                    {order.serviceType === "dineIn"
                      ? tOrders("table", { table: order.tableLabel ?? "?" })
                      : tOrders("service.takeaway")}
                  </span>
                  <OrderStatusBadge status={order.status} />
                </span>
                <span className="truncate text-body-small text-muted-foreground sm:text-body-caption">
                  {order.customerName} · {tOrders("itemCount", { count: orderItemCount(order) })}
                </span>
              </span>

              {canFulfill ? (
                <QueueStepButton orderId={order.id} orderNumber={order.orderNumber} status={order.status} />
              ) : null}
            </OverviewPanelRow>
          );
        })
      )}
    </OverviewPanel>
  );
}
