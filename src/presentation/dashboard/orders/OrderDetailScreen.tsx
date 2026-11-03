import { getLocale, getTranslations } from "next-intl/server";

import {
  canRefundOrder,
  canServeItems,
  canWriteOffOrder,
  orderItemCount,
  servedLineCount,
  type Order,
} from "@/src/domain/entities/Order";
import type { OrderNote } from "@/src/domain/entities/OrderNote";
import type { OrderRefund } from "@/src/domain/entities/OrderRefund";
import type { OrderStatusEvent } from "@/src/domain/entities/OrderStatusEvent";
import type { OrderPaymentAttempt } from "@/src/domain/entities/PaymentAttempt";
import { formatCafeDayMedium } from "@/src/lib/formatCafeDay";
import { formatMoney } from "@/src/lib/formatMoney";
import { formatNumber } from "@/src/lib/formatNumber";
import { formatOrderDate, formatOrderTime } from "@/src/lib/formatOrderDate";
import { cn } from "@/src/lib/utils";
import { AutoRefresh } from "@/src/presentation/components/AutoRefresh";
import { DashboardColumns } from "@/src/presentation/dashboard/DashboardColumns";
import { DashboardPageHeader } from "@/src/presentation/dashboard/DashboardPageHeader";
import { DashboardSection } from "@/src/presentation/dashboard/DashboardSection";
import { FIELD_HINT, OVERLINE } from "@/src/presentation/dashboard/fieldStyles";
import { MessageGuestButton } from "@/src/presentation/dashboard/guest-messages/MessageGuestButton";
import { ProductThumbnail } from "@/src/presentation/dashboard/ProductThumbnail";
import { DashboardPageCrumb } from "@/src/presentation/dashboard/shell/DashboardPageCrumb";
import { OrderTotals } from "@/src/presentation/orders/OrderTotals";

import { OrderItemServeToggle } from "./OrderItemServeToggle";
import { OrderItemStateBadge } from "./OrderItemStateBadge";
import { OrderNotesPanel } from "./OrderNotesPanel";
import { OrderOnlinePayments } from "./OrderOnlinePayments";
import { OrderPaymentToggle } from "./OrderPaymentToggle";
import { OrderServiceLabel } from "./OrderServiceLabel";
import { OrderStatusActions } from "./OrderStatusActions";
import { OrderStatusBadge } from "./OrderStatusBadge";
import { OrderTimeline } from "./OrderTimeline";
import { RefundOrderButton } from "./RefundOrderButton";
import { WriteOffOrderButton } from "./WriteOffOrderButton";

/** A detail screen left open re-reads less often than the list — it's one order. */
const REFRESH_SECONDS = 30;

type OrderDetailScreenProps = {
  order: Order;
  events: OrderStatusEvent[];
  notes: OrderNote[];
  /** Money handed back on the order, oldest first. */
  refunds: OrderRefund[];
  /** Online payments captured after the order was paid another way or cancelled, oldest first. */
  onlinePayments: OrderPaymentAttempt[];
  /** Whether the viewer may move the order along and mark it paid. */
  canFulfill: boolean;
  /** Whether the viewer may hand money back. */
  canRefund: boolean;
  /** Whether the viewer may write off a served order nobody paid for. */
  canWriteOff: boolean;
  /** Whether the viewer may mark an online payment the order didn't take as given back. */
  canGiveBack: boolean;
  /** Whether the viewer may add an internal note. */
  canNote: boolean;
};

/**
 * Dashboard order detail. Presentational: the page fetches the order, its status
 * history and notes over the REST API (BFF) during server render. Controls are
 * drawn only for what the viewer may do; every endpoint re-checks.
 */
export async function OrderDetailScreen({
  order,
  events,
  notes,
  refunds,
  onlinePayments,
  canFulfill,
  canRefund,
  canWriteOff,
  canGiveBack,
  canNote,
}: OrderDetailScreenProps) {
  const t = await getTranslations("dashOrders");
  const locale = await getLocale();
  const serving = canServeItems(order.status);
  const refundable = canRefund && canRefundOrder(order);
  const writable = canWriteOff && canWriteOffOrder(order);

  return (
    <div className="flex flex-col gap-6">
      <AutoRefresh intervalSeconds={REFRESH_SECONDS} />
      <DashboardPageCrumb label={`#${order.orderNumber}`} />

      <DashboardPageHeader
        backHref="/dashboard/orders"
        backLabel={t("backToOrders")}
        title={t("orderNumber", { number: order.orderNumber })}
        subtitle={t("placedOn", { date: formatOrderDate(order.placedAt, locale) })}
        badge={<OrderStatusBadge status={order.status} size="compact" />}
        actions={
          refundable || writable || canFulfill ? (
            <>
              {refundable ? <RefundOrderButton order={order} /> : null}
              {writable ? <WriteOffOrderButton order={order} /> : null}
              {canFulfill ? (
                <OrderStatusActions orderId={order.id} orderNumber={order.orderNumber} status={order.status} />
              ) : null}
            </>
          ) : null
        }
      />

      <DashboardColumns
        main={
          <>
            <DashboardSection
              title={t("itemsHeading")}
              aside={
                <>
                  {t("itemCount", { count: orderItemCount(order) })}
                  {serving ? ` · ${t("servedProgress", servedLineCount(order))}` : null}
                </>
              }
              flush
            >
              <ul>
                {order.items.map((item) => (
                  <li key={item.id} className="flex gap-3 border-t border-border px-5 py-4 first:border-t-0">
                    <ProductThumbnail src={item.imageUrl} size="line" />
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      {/* The price drops under a name that would be left under 12rem, at the line's end. */}
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                        <span className="min-w-0 flex-[1_1_12rem] font-medium text-foreground">
                          <span className="text-muted-foreground tabular-nums">
                            {formatNumber(item.quantity, locale)}×
                          </span>{" "}
                          {item.name}
                        </span>
                        <span className="ms-auto flex-none whitespace-nowrap text-foreground tabular-nums">
                          {formatMoney(item.unitPrice * item.quantity, locale)}
                        </span>
                      </div>
                      {item.note ? <p className={cn(FIELD_HINT, "text-warning-foreground")}>{item.note}</p> : null}
                      {item.refundedQuantity ? (
                        <p className={cn(FIELD_HINT, "text-error-foreground")}>
                          {t("refund.lineRefunded", { quantity: formatNumber(item.refundedQuantity, locale) })}
                        </p>
                      ) : null}
                      {serving || item.servedAt ? (
                        <div className="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-2 sm:min-h-8">
                          <OrderItemStateBadge item={item} dense />
                          {item.servedAt ? (
                            <span className={cn(FIELD_HINT, "tabular-nums")}>
                              {t("servedAt", { time: formatOrderTime(item.servedAt, locale) })}
                            </span>
                          ) : null}
                          {serving && canFulfill ? (
                            <OrderItemServeToggle
                              orderId={order.id}
                              itemId={item.id}
                              itemName={item.name}
                              served={Boolean(item.servedAt)}
                            />
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
              <OrderTotals order={order} inset />
            </DashboardSection>

            {refunds.length > 0 ? (
              <DashboardSection title={t("refund.heading")} flush>
                <ul>
                  {refunds.map((refund) => (
                    <li
                      key={refund.id}
                      className="flex flex-col gap-1 border-t border-border px-5 py-4 first:border-t-0"
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                        <span className="min-w-0 flex-[1_1_12rem] font-medium text-foreground">
                          R-{refund.number} · {t(`paymentMethod.${refund.method}`)}
                        </span>
                        <span className="ms-auto flex-none font-semibold whitespace-nowrap text-foreground tabular-nums">
                          {formatMoney(refund.amount, locale)}
                        </span>
                      </div>
                      <p className={FIELD_HINT}>
                        {formatCafeDayMedium(refund.date, locale)} · {t("timelineBy", { name: refund.createdByName })}
                      </p>
                      <p className={FIELD_HINT}>
                        {refund.lines
                          .map(
                            (line) =>
                              `${formatNumber(line.quantity, locale)}× ${line.name}${
                                line.restocked ? ` (${t("refund.restocked")})` : ""
                              }`,
                          )
                          .join("، ")}
                      </p>
                      {refund.reason ? <q className={FIELD_HINT}>{refund.reason}</q> : null}
                    </li>
                  ))}
                </ul>
              </DashboardSection>
            ) : null}

            <OrderOnlinePayments payments={onlinePayments} canGiveBack={canGiveBack} />

            <DashboardSection title={t("notesHeading")} aside={t("notesHint")}>
              <OrderNotesPanel orderId={order.id} notes={notes} canWrite={canNote} />
            </DashboardSection>
          </>
        }
        side={
          <>
            <DashboardSection title={t("serviceHeading")} flush>
              <dl className="flex flex-col gap-5 p-5">
                <div className="flex flex-col gap-1">
                  <dt className={OVERLINE}>{t("colService")}</dt>
                  <dd className="font-medium">
                    <OrderServiceLabel order={order} />
                  </dd>
                </div>
                <div className="flex flex-col gap-1">
                  <dt className={OVERLINE}>{t("colGuest")}</dt>
                  <dd className="flex flex-col">
                    <span className="font-medium text-foreground">{order.customerName}</span>
                    {order.customerPhone ? (
                      <span dir="ltr" className="self-start text-muted-foreground tabular-nums">
                        {order.customerPhone}
                      </span>
                    ) : null}
                    {canFulfill && order.customerPhone ? (
                      <span className="mt-2 self-start">
                        <MessageGuestButton
                          appearance="secondary"
                          guest={{ name: order.customerName, phone: order.customerPhone }}
                          about={{ kind: "order", id: order.id, label: `#${order.orderNumber}` }}
                        />
                      </span>
                    ) : null}
                  </dd>
                </div>
                {order.note ? (
                  <div className="flex flex-col gap-1">
                    <dt className={OVERLINE}>{t("guestNote")}</dt>
                    <dd className="whitespace-pre-wrap text-foreground/80">
                      <q>{order.note}</q>
                    </dd>
                  </div>
                ) : null}
                <div className="flex flex-col gap-2">
                  <dt className={OVERLINE}>{t("filterPayment")}</dt>
                  <dd>
                    {canFulfill ? (
                      <OrderPaymentToggle
                        orderId={order.id}
                        total={order.total}
                        paymentStatus={order.paymentStatus}
                        paymentMethod={order.paymentMethod}
                        paymentParts={order.paymentParts}
                        cancelled={order.status === "cancelled"}
                        refunded={order.refundedTotal > 0}
                      />
                    ) : (
                      <p className="text-foreground/80">
                        {t(`payment.${order.paymentStatus}`)}
                        {order.paymentMethod ? ` · ${t(`paymentMethod.${order.paymentMethod}`)}` : null}
                      </p>
                    )}
                  </dd>
                </div>
              </dl>
            </DashboardSection>

            <DashboardSection title={t("timelineHeading")}>
              <OrderTimeline events={events} />
            </DashboardSection>
          </>
        }
      />
    </div>
  );
}
