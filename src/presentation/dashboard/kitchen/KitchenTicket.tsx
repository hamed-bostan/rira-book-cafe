import { MessageSquare, ShoppingBag, Utensils } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { isLateOrder, minutesWaiting } from "@/src/domain/entities/Kitchen";
import { canServeItems, servedLineCount, type Order } from "@/src/domain/entities/Order";
import { formatNumber } from "@/src/lib/formatNumber";
import { cn } from "@/src/lib/utils";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";

import { KitchenAdvanceButton } from "./KitchenAdvanceButton";
import { KitchenItemCheck } from "./KitchenItemCheck";
import { KitchenWaitPill } from "./KitchenWaitPill";

type KitchenTicketProps = {
  order: Order;
  /** "Now", from the page, so waiting times are judged on the server's clock. */
  now: Date;
  /** "Table 2" or "Takeaway". */
  service: string;
  canFulfill: boolean;
};

/**
 * One order on the board, big enough to read from behind the bar: the number,
 * where it goes and who for, how long it has waited, the guest's note, every line,
 * and the button that moves it on. While it's being made each line is a tick-box
 * ("2 of 3 ready"), and "Mark served" turns primary once all are ticked. A late
 * order gets a red border.
 */
export function KitchenTicket({ order, now, service, canFulfill }: KitchenTicketProps) {
  const t = useTranslations("dashKitchen");
  const locale = useLocale();
  const waited = minutesWaiting(order, now);
  const late = isLateOrder(order, now);
  const number = formatNumber(order.orderNumber, locale);
  const making = order.status === "preparing";
  const checkable = canFulfill && canServeItems(order.status);
  const { served, total } = servedLineCount(order);
  const allReady = served === total;
  const ServiceIcon = order.serviceType === "dineIn" ? Utensils : ShoppingBag;

  return (
    <article
      aria-label={t("ticketAria", { number, service })}
      className={cn(
        "flex min-w-0 flex-col gap-4 rounded-card-lg border bg-background p-4 shadow-xs",
        late ? "border-error-border ring-1 ring-error-border" : "border-border",
      )}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-2xl font-bold tracking-tight text-foreground tabular-nums lg:text-3xl">#{number}</span>
          <span className="flex min-w-0 items-center gap-1.5 text-body-default text-foreground sm:text-body-small">
            <Icon icon={ServiceIcon} size="icon-md" className="text-icon-accent" />
            <span className="font-semibold whitespace-nowrap">{service}</span>
            {order.customerName ? (
              <span className="truncate text-muted-foreground">{t("guest", { name: order.customerName })}</span>
            ) : null}
          </span>
        </div>
        <KitchenWaitPill minutes={waited} placedAt={order.placedAt} />
      </header>

      {order.note ? (
        <p className="flex items-start gap-2 rounded-button bg-warning px-3 py-2 text-body-default font-medium text-warning-foreground sm:text-body-small">
          <Icon icon={MessageSquare} size="icon-md" className="mt-0.5" />
          {order.note}
        </p>
      ) : null}

      <ul aria-label={t("itemsLabel")} className="flex flex-col border-t border-border">
        {order.items.map((item) => {
          const quantity = formatNumber(item.quantity, locale);
          return (
            <li key={item.id} className="border-b border-border">
              {checkable ? (
                <KitchenItemCheck
                  orderId={order.id}
                  itemId={item.id}
                  quantity={quantity}
                  name={item.name}
                  note={item.note}
                  served={Boolean(item.servedAt)}
                />
              ) : (
                <div className="flex flex-col py-2">
                  <span
                    className={cn(
                      "flex gap-2 text-body-lead font-semibold lg:text-heading-subsection",
                      item.servedAt ? "text-muted-foreground line-through" : "text-foreground",
                    )}
                  >
                    <span className="shrink-0 tabular-nums">{quantity}×</span>
                    <span className="min-w-0">{item.name}</span>
                  </span>
                  {item.note ? (
                    <span className="text-body-default font-medium text-muted-foreground sm:text-body-small">
                      {item.note}
                    </span>
                  ) : null}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {making || canFulfill ? (
        <div className="flex flex-col gap-2">
          {making ? (
            <span
              className={cn(
                "text-body-small font-medium sm:text-body-caption",
                allReady ? "text-success-foreground" : "text-muted-foreground",
              )}
            >
              {allReady
                ? t("allReady")
                : t("itemsReady", { ready: formatNumber(served, locale), total: formatNumber(total, locale) })}
            </span>
          ) : null}
          {canFulfill ? (
            <KitchenAdvanceButton orderId={order.id} number={number} status={order.status} allReady={allReady} />
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
