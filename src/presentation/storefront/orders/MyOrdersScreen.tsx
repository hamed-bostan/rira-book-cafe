import { ClipboardList } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { orderItemCount, type Order } from "@/src/domain/entities/Order";
import { Link } from "@/src/i18n/navigation";
import { formatMoney } from "@/src/lib/formatMoney";
import { formatNumber } from "@/src/lib/formatNumber";
import { formatOrderDateShort, formatOrderTime } from "@/src/lib/formatOrderDate";
import { cn } from "@/src/lib/utils";
import { OrderStatusBadge } from "@/src/presentation/dashboard/orders/OrderStatusBadge";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { EmptyState } from "@/src/presentation/design-system/components/EmptyState/EmptyState";
import { focusRing } from "@/src/presentation/design-system/components/shared/focusRing";

/** The guest's order history, newest first; each links to its live status page. */
export async function MyOrdersScreen({ orders }: { orders: Order[] }) {
  const t = await getTranslations("site");
  const locale = await getLocale();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <h1 className="text-heading-page text-foreground">{t("orders.heading")}</h1>
      {orders.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title={t("orders.empty")}
          action={
            <Button asChild size="sm">
              <Link href="/menu">{t("home.seeMenu")}</Link>
            </Button>
          }
          className="rounded-card-lg border border-dashed border-border py-10"
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {orders.map((order) => (
            <li key={order.id}>
              <Link
                href={`/orders/${order.id}`}
                className={cn(
                  "flex items-center gap-3 rounded-card-md border border-border p-4 transition-colors hover:bg-muted",
                  focusRing,
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-body-small-strong text-foreground">#{formatNumber(order.orderNumber, locale)}</p>
                  <p className="text-body-caption text-muted-foreground">
                    {formatOrderDateShort(order.placedAt, locale)} · {formatOrderTime(order.placedAt, locale)} ·{" "}
                    {t("orders.itemCount", {
                      count: orderItemCount(order),
                      formatted: formatNumber(orderItemCount(order), locale),
                    })}
                  </p>
                </div>
                <OrderStatusBadge status={order.status} />
                <span className="text-body-small-emphasis text-foreground">{formatMoney(order.total, locale)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
