import { ChevronLeft } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { canServeItems, orderItemCount, servedLineCount, type Order } from "@/src/domain/entities/Order";
import type { OrderNote } from "@/src/domain/entities/OrderNote";
import type { OrderStatusEvent } from "@/src/domain/entities/OrderStatusEvent";
import { Link } from "@/src/i18n/navigation";
import { formatMoney } from "@/src/lib/formatMoney";
import { formatNumber } from "@/src/lib/formatNumber";
import { formatOrderDate, formatOrderTime } from "@/src/lib/formatOrderDate";
import { AutoRefresh } from "@/src/presentation/components/AutoRefresh";
import { DashboardPanel, DashboardPanelHeader } from "@/src/presentation/dashboard/DashboardPanel";
import { ProductThumbnail } from "@/src/presentation/dashboard/ProductThumbnail";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";
import { OrderTotals } from "@/src/presentation/orders/OrderTotals";

import { OrderItemServeToggle } from "./OrderItemServeToggle";
import { OrderItemStateBadge } from "./OrderItemStateBadge";
import { OrderNotesPanel } from "./OrderNotesPanel";
import { OrderPaymentToggle } from "./OrderPaymentToggle";
import { OrderServiceLabel } from "./OrderServiceLabel";
import { OrderStatusActions } from "./OrderStatusActions";
import { OrderStatusBadge } from "./OrderStatusBadge";
import { OrderTimeline } from "./OrderTimeline";

/** A detail screen left open re-reads less often than the list — it's one order. */
const REFRESH_SECONDS = 30;

type OrderDetailScreenProps = {
  order: Order;
  events: OrderStatusEvent[];
  notes: OrderNote[];
  /** Whether the viewer may move the order along and mark it paid. */
  canFulfill: boolean;
  /** Whether the viewer may add an internal note. */
  canNote: boolean;
};

/**
 * Dashboard order detail. Presentational: the page fetches the order, its status
 * history and notes over the REST API (BFF) during server render. Controls are
 * drawn only for what the viewer may do; every endpoint re-checks.
 */
export async function OrderDetailScreen({ order, events, notes, canFulfill, canNote }: OrderDetailScreenProps) {
  const t = await getTranslations("dashOrders");
  const locale = await getLocale();
  const serving = canServeItems(order.status);

  return (
    <div className="flex flex-col gap-6">
      <AutoRefresh intervalSeconds={REFRESH_SECONDS} />

      <div className="flex flex-col gap-3">
        <Link
          href="/dashboard/orders"
          className="inline-flex w-fit items-center gap-1 text-body-small-strong text-muted-foreground transition-colors hover:text-foreground"
        >
          <Icon icon={ChevronLeft} size="xs" className="rtl:-scale-x-100" />
          {t("backToOrders")}
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="dashboard-page-title">{t("orderNumber", { number: order.orderNumber })}</h1>
            <p className="text-body-small text-muted-foreground">
              {t("placedOn", { date: formatOrderDate(order.placedAt, locale) })}
            </p>
          </div>
          <OrderStatusBadge status={order.status} />
        </div>
        {canFulfill ? (
          <OrderStatusActions orderId={order.id} orderNumber={order.orderNumber} status={order.status} />
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-6">
          <DashboardPanel>
            <DashboardPanelHeader
              title={t("itemsHeading")}
              action={
                <span className="text-body-small text-muted-foreground">
                  {t("itemCount", { count: orderItemCount(order) })}
                  {serving ? ` · ${t("servedProgress", servedLineCount(order))}` : null}
                </span>
              }
            />
            <ul className="mt-4 flex flex-col divide-y divide-border">
              {order.items.map((item) => (
                <li key={item.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                  <ProductThumbnail src={item.imageUrl} size="table" />
                  <div className="min-w-0 flex-1">
                    <p className="text-body-small-strong text-foreground">
                      <span className="tabular-nums">{formatNumber(item.quantity, locale)}×</span> {item.name}
                    </p>
                    {item.note ? <p className="text-body-small text-warning-foreground">{item.note}</p> : null}
                    {serving || item.servedAt ? (
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        <OrderItemStateBadge item={item} />
                        {item.servedAt ? (
                          <span className="text-body-caption text-muted-foreground">
                            {t("servedAt", { time: formatOrderTime(item.servedAt, locale) })}
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className="text-body-small-emphasis whitespace-nowrap text-foreground">
                      {formatMoney(item.unitPrice * item.quantity, locale)}
                    </span>
                    {serving && canFulfill ? (
                      <OrderItemServeToggle
                        orderId={order.id}
                        itemId={item.id}
                        itemName={item.name}
                        served={Boolean(item.servedAt)}
                      />
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-4">
              <OrderTotals order={order} />
            </div>
          </DashboardPanel>

          <DashboardPanel>
            <DashboardPanelHeader title={t("notesHeading")} />
            <div className="mt-4">
              <OrderNotesPanel orderId={order.id} notes={notes} canWrite={canNote} />
            </div>
          </DashboardPanel>
        </div>

        <div className="flex flex-col gap-6">
          <DashboardPanel>
            <DashboardPanelHeader title={t("serviceHeading")} />
            <dl className="mt-4 flex flex-col gap-3 text-body-small">
              <div>
                <dt className="text-muted-foreground">{t("colService")}</dt>
                <dd className="mt-1">
                  <OrderServiceLabel order={order} />
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t("colGuest")}</dt>
                <dd className="mt-1 text-foreground">{order.customerName}</dd>
                <dd dir="ltr" className="text-start text-muted-foreground">
                  {order.customerPhone}
                </dd>
              </div>
              {order.note ? (
                <div>
                  <dt className="text-muted-foreground">{t("guestNote")}</dt>
                  <dd className="mt-1 whitespace-pre-wrap text-foreground">{order.note}</dd>
                </div>
              ) : null}
            </dl>
            <div className="mt-4 border-t border-border pt-4">
              {canFulfill ? (
                <OrderPaymentToggle
                  orderId={order.id}
                  paymentStatus={order.paymentStatus}
                  paymentMethod={order.paymentMethod}
                  cancelled={order.status === "cancelled"}
                />
              ) : (
                <p className="text-body-small text-foreground">
                  {t(`payment.${order.paymentStatus}`)}
                  {order.paymentMethod ? ` · ${t(`paymentMethod.${order.paymentMethod}`)}` : null}
                </p>
              )}
            </div>
          </DashboardPanel>

          <DashboardPanel>
            <DashboardPanelHeader title={t("timelineHeading")} />
            <div className="mt-4">
              <OrderTimeline events={events} />
            </div>
          </DashboardPanel>
        </div>
      </div>
    </div>
  );
}
