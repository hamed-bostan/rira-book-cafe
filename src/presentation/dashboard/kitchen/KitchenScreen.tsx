import { getLocale, getTranslations } from "next-intl/server";

import { KITCHEN_LANES, kitchenLanes, lateOrderCount } from "@/src/domain/entities/Kitchen";
import type { Order } from "@/src/domain/entities/Order";
import { formatNumber } from "@/src/lib/formatNumber";
import { formatOrderTime } from "@/src/lib/formatOrderDate";
import { AutoRefresh } from "@/src/presentation/components/AutoRefresh";

import { KitchenFullScreenToggle } from "./KitchenFullScreenToggle";
import { KitchenLane } from "./KitchenLane";
import { KitchenLaneTabs } from "./KitchenLaneTabs";
import { KitchenNewOrderToasts } from "./KitchenNewOrderToasts";

type KitchenScreenProps = {
  /** Every active order. */
  orders: Order[];
  /** "Now", from the page, so waiting times are judged on the server's clock. */
  now: string;
  canFulfill: boolean;
};

/** How often the board re-reads the queue — fast enough that a new order shows before anyone asks. */
const REFRESH_SECONDS = 15;

/**
 * The bar's wall screen: what's new and what's being made, oldest first, with
 * every line of each order. A new order is started with one tap; while it's made
 * its lines are ticked off, and it's marked served. The board refreshes itself
 * (the "Live" time is that of the last refresh), announces orders that arrived
 * since, and can take the whole screen. Presentational — the page fetches over
 * the REST API.
 */
export async function KitchenScreen({ orders, now, canFulfill }: KitchenScreenProps) {
  const t = await getTranslations("dashKitchen");
  const tOrders = await getTranslations("dashOrders");
  const locale = await getLocale();
  const nowDate = new Date(now);
  const lanes = kitchenLanes(orders);

  function serviceOf(order: Order): string {
    return order.serviceType === "dineIn"
      ? tOrders("table", { table: order.tableLabel ?? "?" })
      : tOrders("service.takeaway");
  }

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <AutoRefresh intervalSeconds={REFRESH_SECONDS} />
      <KitchenNewOrderToasts
        notices={lanes.new.map((order) => ({
          id: order.id,
          text: t("newOrderToast", { number: formatNumber(order.orderNumber, locale), service: serviceOf(order) }),
        }))}
      />

      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="dashboard-page-title">{t("heading")}</h1>
          <p className="text-body-default text-pretty text-muted-foreground sm:text-body-small">{t("subtitle")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <p
            role="status"
            className="flex items-center gap-2 text-body-small whitespace-nowrap text-muted-foreground tabular-nums sm:text-body-caption"
          >
            <span aria-hidden className="size-2 shrink-0 rounded-full bg-primary ring-4 ring-accent" />
            {t("live", { time: formatOrderTime(now, locale) })}
          </p>
          <KitchenFullScreenToggle />
        </div>
      </div>

      <KitchenLaneTabs
        label={t("lanesLabel")}
        lanes={KITCHEN_LANES.map((lane) => ({
          lane,
          label: t(`lane.${lane}`),
          count: formatNumber(lanes[lane].length, locale),
          hasLate: lateOrderCount(lanes[lane], nowDate) > 0,
          content: (
            <KitchenLane lane={lane} orders={lanes[lane]} now={nowDate} serviceOf={serviceOf} canFulfill={canFulfill} />
          ),
        }))}
      />
    </div>
  );
}
