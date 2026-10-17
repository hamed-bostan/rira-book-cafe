import { Clock, StickyNote } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import {
  KITCHEN_LANES,
  KITCHEN_LATE_MINUTES,
  KITCHEN_STATIONS,
  kitchenLanes,
  minutesWaiting,
  type KitchenStation,
} from "@/src/domain/entities/Kitchen";
import { canServeItems, type Order } from "@/src/domain/entities/Order";
import { Link } from "@/src/i18n/navigation";
import { formatNumber } from "@/src/lib/formatNumber";
import { cn } from "@/src/lib/utils";
import { AutoRefresh } from "@/src/presentation/components/AutoRefresh";
import { Icon, focusRing } from "@/src/presentation/design-system";

import { OrderItemServeToggle } from "../orders/OrderItemServeToggle";
import { OrderServiceLabel } from "../orders/OrderServiceLabel";

import { KitchenAdvanceButton } from "./KitchenAdvanceButton";

type KitchenScreenProps = {
  /** Every active order (the board filters by station itself). */
  orders: Order[];
  station: KitchenStation;
  /** "Now", from the page, so waiting times are judged on the server's clock. */
  now: string;
  canFulfill: boolean;
};

/** How often the board re-reads the queue — fast enough that a new order shows before anyone asks. */
const REFRESH_SECONDS = 15;

/**
 * The bar and kitchen's wall screen: what's new, what's being made and what's
 * waiting at the pass, oldest first, with only the station's own lines. Lines are
 * ticked off as they go out and each order moves on with one tap. Presentational
 * — the page fetches over the REST API, and the board refreshes itself.
 */
export async function KitchenScreen({ orders, station, now, canFulfill }: KitchenScreenProps) {
  const t = await getTranslations("dashKitchen");
  const locale = await getLocale();
  const nowDate = new Date(now);
  const lanes = kitchenLanes(orders, station);

  return (
    <div className="@container flex min-w-0 flex-col gap-4">
      <AutoRefresh intervalSeconds={REFRESH_SECONDS} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="dashboard-page-title">{t("heading")}</h1>
          <p className="text-body-small text-muted-foreground">{t("subtitle")}</p>
        </div>
        <nav aria-label={t("stationLabel")} className="flex gap-1 rounded-full bg-muted p-1">
          {KITCHEN_STATIONS.map((option) => (
            <Link
              key={option}
              href={option === "all" ? "/dashboard/kitchen" : `/dashboard/kitchen?station=${option}`}
              aria-current={option === station ? "page" : undefined}
              className={cn(
                "rounded-full px-4 py-1.5 text-body-small-emphasis",
                focusRing,
                option === station ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t(`station.${option}`)}
            </Link>
          ))}
        </nav>
      </div>

      <div className="grid grid-cols-1 gap-4 @min-[56rem]:grid-cols-3">
        {KITCHEN_LANES.map((lane) => (
          <section key={lane} aria-labelledby={`lane-${lane}`} className="flex min-w-0 flex-col gap-3 rounded-card-lg bg-muted p-3">
            <h2 id={`lane-${lane}`} className="flex items-center justify-between px-1 text-body-strong text-foreground">
              {t(`lane.${lane}`)}
              <span className="rounded-full bg-background px-2.5 py-0.5 text-body-small-strong tabular-nums">
                {formatNumber(lanes[lane].length, locale)}
              </span>
            </h2>
            {lanes[lane].length === 0 ? (
              <p className="px-1 py-6 text-center text-body-small text-muted-foreground">{t("laneEmpty")}</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {lanes[lane].map((order) => {
                  const waited = minutesWaiting(order, nowDate);
                  const late = lane !== "ready" && waited >= KITCHEN_LATE_MINUTES;
                  return (
                    <li
                      key={order.id}
                      className={cn("flex flex-col gap-3 rounded-card-md border bg-background p-3", late ? "border-warning-foreground" : "border-border")}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <Link href={`/dashboard/orders/${order.id}`} className="text-heading-subsection text-foreground hover:underline">
                            #{formatNumber(order.orderNumber, locale)}
                          </Link>
                          <OrderServiceLabel order={order} />
                        </div>
                        <span
                          className={cn(
                            "flex items-center gap-1 rounded-full px-2 py-0.5 text-body-small-strong tabular-nums",
                            late ? "bg-warning text-warning-foreground" : "bg-muted text-muted-foreground",
                          )}
                        >
                          <Icon icon={Clock} size="xs" />
                          {t("minutes", { minutes: formatNumber(waited, locale) })}
                        </span>
                      </div>

                      <ul className="flex flex-col gap-2">
                        {order.items.map((item) => (
                          <li key={item.id} className="flex items-start justify-between gap-2">
                            <div className={cn("min-w-0", item.servedAt ? "text-muted-foreground line-through" : "text-foreground")}>
                              <p className="text-body-strong">
                                <span className="tabular-nums">{formatNumber(item.quantity, locale)}×</span> {item.name}
                              </p>
                              {item.note ? <p className="text-body-small text-warning-foreground">{item.note}</p> : null}
                            </div>
                            {canFulfill && canServeItems(order.status) ? (
                              <OrderItemServeToggle orderId={order.id} itemId={item.id} itemName={item.name} served={Boolean(item.servedAt)} />
                            ) : null}
                          </li>
                        ))}
                      </ul>

                      {order.note ? (
                        <p className="flex items-start gap-1.5 rounded-card-md bg-warning px-2 py-1.5 text-body-small text-warning-foreground">
                          <Icon icon={StickyNote} size="xs" className="mt-0.5 shrink-0" />
                          {order.note}
                        </p>
                      ) : null}

                      {canFulfill ? <KitchenAdvanceButton orderId={order.id} status={order.status} /> : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
