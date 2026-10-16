import { ChevronLeft } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { isActiveOrder, isGuestCancellable, type Order } from "@/src/domain/entities/Order";
import { Link } from "@/src/i18n/navigation";
import { formatMoney } from "@/src/lib/formatMoney";
import { formatNumber } from "@/src/lib/formatNumber";
import { formatOrderDate } from "@/src/lib/formatOrderDate";
import { AutoRefresh } from "@/src/presentation/components/AutoRefresh";
import { OrderServiceLabel } from "@/src/presentation/dashboard/orders/OrderServiceLabel";
import { Badge, Icon } from "@/src/presentation/design-system";

import { CancelMyOrderButton } from "./CancelMyOrderButton";
import { OrderProgress } from "./OrderProgress";

/**
 * The guest's order: number to listen for, progress, what they ordered and what it
 * cost. While it's in the queue the page re-reads itself, so "Ready" shows up
 * without a reload.
 */
export async function MyOrderScreen({ order }: { order: Order }) {
  const t = await getTranslations("site");
  const tOrders = await getTranslations("dashOrders");
  const locale = await getLocale();
  const active = isActiveOrder(order.status);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      {active ? <AutoRefresh intervalSeconds={15} /> : null}

      <Link href="/orders" className="inline-flex w-fit items-center gap-1 text-body-small-strong text-muted-foreground hover:text-foreground">
        <Icon icon={ChevronLeft} size="xs" className="rtl:-scale-x-100" />
        {t("orders.back")}
      </Link>

      <div className="rounded-card-lg bg-accent px-6 py-6 text-center">
        <p className="text-body-small text-muted-foreground">{t("orders.yourNumber")}</p>
        <p className="text-heading-page text-primary">#{formatNumber(order.orderNumber, locale)}</p>
        <p className="mt-1 text-body-small text-muted-foreground">{formatOrderDate(order.placedAt, locale)}</p>
      </div>

      {order.status === "cancelled" ? (
        <p className="rounded-card-md border border-border px-4 py-3 text-center text-body-small text-muted-foreground">{t("orders.cancelled")}</p>
      ) : (
        <>
          <OrderProgress status={order.status} />
          <p className="text-center text-body-default text-foreground">{t(`orders.statusLine.${order.status}`)}</p>
        </>
      )}

      <section className="rounded-card-lg border border-border p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <OrderServiceLabel order={order} />
          <Badge variant={order.paymentStatus === "paid" ? "success" : "neutral"}>{tOrders(`payment.${order.paymentStatus}`)}</Badge>
        </div>
        <ul className="mt-4 flex flex-col divide-y divide-border">
          {order.items.map((item) => (
            <li key={item.id} className="flex items-start justify-between gap-3 py-2.5">
              <div>
                <p className="text-body-small-strong text-foreground">
                  {formatNumber(item.quantity, locale)}× {item.name}
                </p>
                {item.note ? <p className="text-body-caption text-muted-foreground">{item.note}</p> : null}
              </div>
              <span className="text-body-small text-foreground">{formatMoney(item.unitPrice * item.quantity, locale)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
          <span className="text-body-strong text-foreground">{t("basket.total")}</span>
          <span className="text-body-strong text-foreground">{formatMoney(order.total, locale)}</span>
        </div>
        {order.note ? <p className="mt-3 text-body-small text-muted-foreground">{order.note}</p> : null}
      </section>

      {isGuestCancellable(order.status) ? <CancelMyOrderButton orderId={order.id} /> : null}
    </div>
  );
}
