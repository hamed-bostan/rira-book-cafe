import { CalendarClock, ClipboardList, Coins, PartyPopper, Receipt } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { Link } from "@/src/i18n/navigation";
import { formatCafeDayMedium } from "@/src/lib/formatCafeDay";
import { formatMoney } from "@/src/lib/formatMoney";
import { formatNumber } from "@/src/lib/formatNumber";

import { AutoRefresh } from "./orders/AutoRefresh";
import { DailySalesChart } from "./reports/DailySalesChart";
import { TopItemsTable } from "./reports/TopItemsTable";
import { StatCard } from "./StatCard";

import type { DashboardOverviewWire, SalesReportWire } from "./reports/report-response-schema";

const REFRESH_SECONDS = 60;

type DashboardOverviewScreenProps = {
  overview: DashboardOverviewWire;
  /** The last 7 days' sales — present only for viewers with `reports.view`. */
  week: SalesReportWire | null;
};

/**
 * The dashboard's front page. The top row is what the floor needs now — the
 * queue, today's bookings, this week's events — and links straight to each. Money
 * (today's takings, the week's trend, best sellers) is drawn only for viewers who
 * may see revenue.
 */
export async function DashboardOverviewScreen({ overview, week }: DashboardOverviewScreenProps) {
  const t = await getTranslations("dashOverview");
  const tReports = await getTranslations("dashReports");
  const locale = await getLocale();
  const today = week?.daily.at(-1);

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <AutoRefresh intervalSeconds={REFRESH_SECONDS} />

      <div>
        <h1 className="dashboard-page-title">{t("heading")}</h1>
        <p className="mt-1 text-body-small text-muted-foreground">{formatCafeDayMedium(overview.today, locale)}</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label={t("activeOrders")}
          value={formatNumber(overview.activeOrders, locale)}
          hint={t("activeOrdersHint")}
          icon={ClipboardList}
          tone={overview.activeOrders > 0 ? "warning" : "brand"}
          href="/dashboard/orders?status=active"
        />
        <StatCard
          label={t("todayBookings")}
          value={formatNumber(overview.todayReservations.bookings, locale)}
          hint={
            overview.todayReservations.awaitingConfirmation > 0
              ? t("awaitingConfirmation", { count: overview.todayReservations.awaitingConfirmation })
              : t("covers", { count: overview.todayReservations.covers, formatted: formatNumber(overview.todayReservations.covers, locale) })
          }
          icon={CalendarClock}
          tone={overview.todayReservations.awaitingConfirmation > 0 ? "warning" : "info"}
          href="/dashboard/reservations"
        />
        <StatCard
          label={t("upcomingEvents")}
          value={formatNumber(overview.upcomingEvents, locale)}
          hint={t("upcomingEventsHint")}
          icon={PartyPopper}
          tone="info"
          href="/dashboard/events"
        />
      </div>

      {week && today ? (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <StatCard
              label={t("todayRevenue")}
              value={formatMoney(today.revenue, locale)}
              hint={t("weekRevenue", { value: formatMoney(week.summary.revenue, locale) })}
              icon={Coins}
              tone="brand"
              trendValues={week.daily.map((point) => point.revenue)}
              href="/dashboard/reports/sales?range=7d"
            />
            <StatCard
              label={t("todayOrders")}
              value={formatNumber(today.orders, locale)}
              hint={t("weekOrders", { count: week.summary.orders, formatted: formatNumber(week.summary.orders, locale) })}
              icon={Receipt}
              tone="info"
              trendValues={week.daily.map((point) => point.orders)}
              href="/dashboard/reports/sales?range=7d"
            />
          </div>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <DailySalesChart
              daily={week.daily}
              labels={{
                heading: t("weekHeading"),
                revenue: tReports("sales.revenue"),
                orders: tReports("sales.orders"),
                current: tReports("thisPeriod"),
                previous: tReports("previousPeriod"),
                empty: tReports("noSales"),
              }}
            />
            <TopItemsTable items={week.topItems.slice(0, 5)} sort="revenue" keep={{ range: "7d" }} basePath="/dashboard/reports/sales" />
          </div>
          <Link href="/dashboard/reports" className="w-fit text-body-small-emphasis text-primary underline-offset-4 hover:underline">
            {t("allReports")}
          </Link>
        </>
      ) : null}
    </div>
  );
}
