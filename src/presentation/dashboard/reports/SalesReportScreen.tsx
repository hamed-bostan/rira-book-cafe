import { Ban, Coins, Receipt, ShoppingBag } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import type { AnalyticsRangePreset, TopItemSort } from "@/src/domain/entities/Analytics";
import { formatMoney } from "@/src/lib/formatMoney";
import { formatNumber } from "@/src/lib/formatNumber";

import { StatCard } from "../StatCard";

import { deltaProps } from "./delta";
import { LazyDailySalesChart } from "./LazyDailySalesChart";
import { LazyHourlyOrdersChart } from "./LazyHourlyOrdersChart";
import { ReportHeader } from "./ReportHeader";
import { ShareBars } from "./ShareBars";
import { TopItemsTable } from "./TopItemsTable";

import type { SalesReportWire } from "./report-response-schema";

type SalesReportScreenProps = {
  report: SalesReportWire;
  selected: AnalyticsRangePreset | "custom";
  sort: TopItemSort;
  /** The page's range params, kept when switching sort. */
  keep: Record<string, string>;
};

/** Revenue, orders, busy hours, what sold and how it was served — against the period before. */
export async function SalesReportScreen({ report, selected, sort, keep }: SalesReportScreenProps) {
  const t = await getTranslations("dashReports");
  const tProducts = await getTranslations("dashProducts");
  const tOrders = await getTranslations("dashOrders");
  const locale = await getLocale();
  const { summary, previousSummary } = report;
  const vsPrevious = t("vsPrevious");

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <ReportHeader
        title={t("sales.title")}
        subtitle={t("sales.subtitle")}
        range={report.range}
        previousRange={report.previousRange}
        selected={selected}
        keep={sort === "revenue" ? {} : { sort }}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t("sales.revenue")}
          value={formatMoney(summary.revenue, locale)}
          icon={Coins}
          tone="brand"
          {...deltaProps(summary.revenue, previousSummary.revenue, locale, vsPrevious)}
        />
        <StatCard
          label={t("sales.orders")}
          value={formatNumber(summary.orders, locale)}
          icon={Receipt}
          tone="info"
          {...deltaProps(summary.orders, previousSummary.orders, locale, vsPrevious)}
        />
        <StatCard
          label={t("sales.averageOrder")}
          value={formatMoney(summary.averageOrderValue, locale)}
          icon={ShoppingBag}
          tone="info"
          {...deltaProps(summary.averageOrderValue, previousSummary.averageOrderValue, locale, vsPrevious)}
        />
        <StatCard
          label={t("sales.cancelled")}
          value={formatNumber(summary.cancelledOrders, locale)}
          hint={t("sales.cancelledValue", { value: formatMoney(summary.cancelledValue, locale) })}
          icon={Ban}
          tone={summary.cancelledOrders > 0 ? "warning" : "brand"}
        />
      </div>

      <LazyDailySalesChart
        daily={report.daily}
        previousDaily={report.previousDaily}
        labels={{
          heading: t("sales.dailyHeading"),
          revenue: t("sales.revenue"),
          orders: t("sales.orders"),
          current: t("thisPeriod"),
          previous: t("previousPeriod"),
          empty: t("noSales"),
        }}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <LazyHourlyOrdersChart
          hourly={report.hourly}
          labels={{
            heading: t("sales.hourlyHeading"),
            description: t("sales.hourlyDescription"),
            orders: t("sales.orders"),
            empty: t("noSales"),
          }}
        />
        <div className="flex flex-col gap-6">
          <ShareBars
            heading={t("sales.byKindHeading")}
            empty={t("noSales")}
            rows={report.byKind.map((row) => ({
              key: row.kind,
              label: tProducts(`kind.${row.kind}`),
              value: row.revenue,
              valueLabel: formatMoney(row.revenue, locale),
              detail: t("unitsSold", { count: row.quantity, formatted: formatNumber(row.quantity, locale) }),
            }))}
          />
          <ShareBars
            heading={t("sales.byServiceHeading")}
            empty={t("noSales")}
            rows={report.byService.map((row) => ({
              key: row.serviceType,
              label: tOrders(`service.${row.serviceType}`),
              value: row.revenue,
              valueLabel: formatMoney(row.revenue, locale),
              detail: t("orderCount", { count: row.orders, formatted: formatNumber(row.orders, locale) }),
            }))}
          />
        </div>
      </div>

      <TopItemsTable items={report.topItems} sort={sort} keep={keep} basePath="/dashboard/reports/sales" />
    </div>
  );
}
