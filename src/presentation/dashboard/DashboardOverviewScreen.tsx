import { CalendarClock, ClipboardList, Coins, PartyPopper, Receipt, RefreshCw } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import type { TopItemSort } from "@/src/domain/entities/Analytics";
import type { StockItem } from "@/src/domain/entities/Inventory";
import type { Order } from "@/src/domain/entities/Order";
import type { Page } from "@/src/domain/entities/Pagination";
import type { Reservation } from "@/src/domain/entities/Reservation";
import { formatCafeDayFull, formatCafeDayLong, formatCafeDayWeekday } from "@/src/lib/formatCafeDay";
import { moneyUnit } from "@/src/lib/formatMoney";
import { formatNumber } from "@/src/lib/formatNumber";
import { formatOrderTime } from "@/src/lib/formatOrderDate";
import { AutoRefresh } from "@/src/presentation/components/AutoRefresh";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";

import { LowStockAlert } from "./inventory/LowStockAlert";
import { OrderQueuePanel } from "./overview/OrderQueuePanel";
import { OverviewStat } from "./overview/OverviewStat";
import { ReservationsPanel } from "./overview/ReservationsPanel";
import { TopItemsPanel } from "./overview/TopItemsPanel";
import { minutesWaiting, WAIT_WARN_MINUTES } from "./overview/waiting";
import { WeekSalesChart } from "./overview/WeekSalesChart";

import type { DashboardOverviewWire, SalesReportWire } from "./reports/report-response-schema";

const REFRESH_SECONDS = 60;
/** Rows the queue card lists before "View all". */
const QUEUE_ROWS = 8;

type DashboardOverviewScreenProps = {
  overview: DashboardOverviewWire;
  /** The open orders, oldest first. */
  queue: Page<Order>;
  /** Today's reservations, in start order. */
  reservations: Reservation[];
  /** The last 7 days' sales — present only for viewers with `reports.view`. */
  week: SalesReportWire | null;
  /** How `week.topItems` is ranked. */
  topSort: TopItemSort;
  /** Stock items, for the low-stock warning (empty without `inventory.view`). */
  stockItems: StockItem[];
  /** When the page was rendered (ISO) — the queue's waits and the "Updated" time. */
  now: string;
  /** Draws the queue's next-step buttons (`orders.fulfill`). */
  canFulfill: boolean;
  /** Draws Confirm on requested bookings (`reservations.manage`). */
  canManageReservations: boolean;
};

/**
 * The dashboard's front page — today at a glance. What the floor needs now leads:
 * stock that's run out, the headline numbers, the order queue and today's
 * bookings, each acting in place. Money (today's takings, the week's trend, best
 * sellers) is drawn only for viewers who may see revenue. Presentational: the page
 * reads everything over the REST API during server render; actions write and
 * `router.refresh()`, and the page re-reads itself every minute.
 */
export async function DashboardOverviewScreen({
  overview,
  queue,
  reservations,
  week,
  topSort,
  stockItems,
  now,
  canFulfill,
  canManageReservations,
}: DashboardOverviewScreenProps) {
  const t = await getTranslations("dashOverview");
  const locale = await getLocale();
  const today = week?.daily.at(-1);

  const placed = queue.items.filter((order) => order.status === "pending").length;
  const preparing = queue.items.length - placed;
  const longWaits = queue.items.filter((order) => minutesWaiting(order.placedAt, now) >= WAIT_WARN_MINUTES).length;
  const awaiting = overview.todayReservations.awaitingConfirmation;

  // Five cards share a row from `xl`; between `sm` and `xl` the three floor cards
  // take a third each and the two money cards a half, so neither row runs ragged.
  const floorSpan = week ? "sm:col-span-2 xl:col-span-1" : undefined;
  const moneySpan = "sm:col-span-3 xl:col-span-1";

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <AutoRefresh intervalSeconds={REFRESH_SECONDS} />

      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div className="flex flex-col gap-1">
          <h1 className="dashboard-page-title">{t("heading")}</h1>
          <p className="text-body-default text-muted-foreground sm:text-body-small">
            {formatCafeDayFull(overview.today, locale)}
          </p>
        </div>
        <p className="flex items-center gap-1.5 text-body-small text-muted-foreground sm:text-body-caption">
          <Icon icon={RefreshCw} size="xs" />
          {t("updated", { time: formatOrderTime(now, locale) })}
        </p>
      </div>

      <LowStockAlert items={stockItems} />

      <div
        className={
          week ? "grid grid-cols-1 gap-3 sm:grid-cols-6 xl:grid-cols-5" : "grid grid-cols-1 gap-3 sm:grid-cols-3"
        }
      >
        <OverviewStat
          label={t("activeOrders")}
          icon={ClipboardList}
          value={formatNumber(queue.total, locale)}
          alert={longWaits > 0}
          hint={
            longWaits > 0
              ? t("longWaits", { count: longWaits, minutes: WAIT_WARN_MINUTES })
              : queue.total === 0
                ? t("nothingWaiting")
                : [
                    placed && t("placedCount", { count: placed }),
                    preparing && t("preparingCount", { count: preparing }),
                  ]
                    .filter(Boolean)
                    .join(" · ")
          }
          href="/dashboard/orders?status=active"
          className={floorSpan}
        />
        <OverviewStat
          label={t("todayBookings")}
          icon={CalendarClock}
          value={formatNumber(overview.todayReservations.bookings, locale)}
          alert={awaiting > 0}
          hint={
            awaiting > 0
              ? t("awaitingConfirmation", { count: awaiting })
              : t("covers", {
                  count: overview.todayReservations.covers,
                  formatted: formatNumber(overview.todayReservations.covers, locale),
                })
          }
          href="/dashboard/reservations"
          className={floorSpan}
        />
        <OverviewStat
          label={t("upcomingEvents")}
          icon={PartyPopper}
          value={formatNumber(overview.upcomingEvents, locale)}
          hint={t("upcomingEventsHint")}
          href="/dashboard/events"
          className={floorSpan}
        />
        {week && today ? (
          <>
            <OverviewStat
              label={t("todayRevenue")}
              icon={Coins}
              value={formatNumber(today.revenue, locale)}
              unit={moneyUnit(locale)}
              hint={t("weekRevenue", { value: `${formatNumber(week.summary.revenue, locale)} ${moneyUnit(locale)}` })}
              href="/dashboard/reports/sales?range=7d"
              className={moneySpan}
            />
            <OverviewStat
              label={t("todayOrders")}
              icon={Receipt}
              value={formatNumber(today.orders, locale)}
              hint={t("weekOrders", {
                count: week.summary.orders,
                formatted: formatNumber(week.summary.orders, locale),
              })}
              href="/dashboard/reports/sales?range=7d"
              className={moneySpan}
            />
          </>
        ) : null}
      </div>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-2">
        <OrderQueuePanel
          orders={queue.items.slice(0, QUEUE_ROWS)}
          total={queue.total}
          now={now}
          canFulfill={canFulfill}
        />
        <ReservationsPanel reservations={reservations} canManage={canManageReservations} />
      </div>

      {week ? (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <WeekSalesChart
            days={week.daily.map((point, index) => {
              const isToday = index === week.daily.length - 1;
              return {
                label: isToday ? t("today") : formatCafeDayWeekday(point.day, locale),
                title: isToday ? t("todaySoFar") : formatCafeDayLong(point.day, locale),
                revenue: point.revenue,
                orders: point.orders,
              };
            })}
          />
          <TopItemsPanel items={week.topItems} sort={topSort} />
        </div>
      ) : null}
    </div>
  );
}
