import { Ban, Receipt, ShoppingBag, Wallet } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import type { AnalyticsRangePreset, TopItemSort } from "@/src/domain/entities/Analytics";
import { PRODUCT_KINDS, type ProductKind } from "@/src/domain/entities/Product";
import { formatCafeDayHeader, formatCafeDayLong, formatCafeDayShort, formatPercent } from "@/src/lib/formatCafeDay";
import { formatMoney, moneyUnit } from "@/src/lib/formatMoney";
import { formatNumber } from "@/src/lib/formatNumber";

import { MetricCard, type MetricCardTone } from "../MetricCard";

import { BestSellers } from "./BestSellers";
import { changeOf, formatChange, formatHourSpan, formatHourTick } from "./reportFormat";
import { reportHref } from "./reportLinks";
import { ReportPanel } from "./ReportPanel";
import { ReportSalesChart, type ReportChartBar } from "./ReportSalesChart";
import { ReportsFrame } from "./ReportsFrame";
import { buildSalesChart, type SalesChartPoint } from "./salesChart";
import { ShareBars } from "./ShareBars";

import type { SalesReportWire } from "./report-response-schema";

/** One hue per kind, in the order the share bars list them. */
const KIND_COLOR: Record<ProductKind, string> = {
  drink: "bg-primary",
  food: "bg-info-foreground",
  book: "bg-warning-foreground",
};

/** At most this many days get a weekday under their bar; longer spans show dates. */
const WEEKDAY_LABEL_DAYS = 7;

type SalesReportScreenProps = {
  report: SalesReportWire;
  selected: AnalyticsRangePreset | "custom";
  sort: TopItemSort;
  /** The page's range params, carried across the tabs and into the ranking links. */
  rangeQuery: Record<string, string>;
  /** The cafe day and hour it is, so the bar still filling up is drawn lighter. */
  now: { day: string; hour: number };
};

/**
 * The Sales tab: revenue, orders, the average order and what was cancelled against
 * the period before; the range's sales as bars; the best sellers; and the split
 * between drinks, food and books. Presentational — the page fetches over the BFF.
 */
export async function SalesReportScreen({ report, selected, sort, rangeQuery, now }: SalesReportScreenProps) {
  const t = await getTranslations("dashReports");
  const locale = await getLocale();
  const { summary, previousSummary } = report;
  const unit = moneyUnit(locale);
  const keep: Record<string, string> = sort === "revenue" ? {} : { sort };

  const change = (current: number, previous: number): { hint: string; hintTone?: MetricCardTone } => {
    const moved = changeOf(current, previous);
    if (!moved) return { hint: t("noBaseline") };
    return {
      hint: t(moved.up ? "changeUp" : "changeDown", { value: formatChange(moved.share, locale) }),
      hintTone: moved.up ? "success" : "danger",
    };
  };

  const chart = buildSalesChart(report.daily, report.hourly, now);
  const label = (point: SalesChartPoint): string => {
    if (!point.labelled) return "";
    if (point.hour !== undefined) return formatHourTick(point.hour, locale);
    if (chart.kind === "daily" && chart.points.length <= WEEKDAY_LABEL_DAYS) {
      return formatCafeDayHeader(point.day, locale).weekday;
    }
    return formatCafeDayShort(point.day, locale);
  };
  const title = (point: SalesChartPoint): string =>
    point.hour !== undefined
      ? formatHourSpan(point.hour, locale)
      : chart.kind === "weekly"
        ? t("sales.weekOf", { day: formatCafeDayShort(point.day, locale) })
        : formatCafeDayLong(point.day, locale);
  const bars: ReportChartBar[] = chart.points.map((point) => ({
    label: label(point),
    title: title(point),
    revenue: point.revenue,
    orders: point.orders,
    soft: point.soft,
  }));

  const kindRevenue = (kind: ProductKind): number => report.byKind.find((row) => row.kind === kind)?.revenue ?? 0;
  const kindTotal = PRODUCT_KINDS.reduce((sum, kind) => sum + kindRevenue(kind), 0);

  return (
    <ReportsFrame
      tab="sales"
      selected={selected}
      rangeQuery={rangeQuery}
      keep={keep}
      range={report.range}
      previousRange={report.previousRange}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label={t("sales.revenue")}
          icon={Wallet}
          value={formatNumber(summary.revenue, locale)}
          unit={unit}
          {...change(summary.revenue, previousSummary.revenue)}
        />
        <MetricCard
          label={t("sales.orders")}
          icon={Receipt}
          value={formatNumber(summary.orders, locale)}
          {...change(summary.orders, previousSummary.orders)}
        />
        <MetricCard
          label={t("sales.averageOrder")}
          icon={ShoppingBag}
          value={formatNumber(summary.averageOrderValue, locale)}
          unit={unit}
          {...change(summary.averageOrderValue, previousSummary.averageOrderValue)}
        />
        <MetricCard
          label={t("sales.cancelled")}
          icon={Ban}
          value={formatNumber(summary.cancelledOrders, locale)}
          hint={t("sales.cancelledValue", { value: formatMoney(summary.cancelledValue, locale) })}
        />
      </div>

      <ReportSalesChart kind={chart.kind} bars={bars} />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <BestSellers
          items={report.topItems}
          sort={sort}
          sortHref={(next) => reportHref("sales", next === "revenue" ? rangeQuery : { ...rangeQuery, sort: next })}
        />
        <ReportPanel title={t("sales.byKindHeading")} description={t("sales.byKindDescription")}>
          {kindTotal === 0 ? (
            <p className="text-body-default text-muted-foreground sm:text-body-small">{t("noSales")}</p>
          ) : (
            <ShareBars
              rows={PRODUCT_KINDS.map((kind) => {
                const share = kindRevenue(kind) / kindTotal;
                return {
                  key: kind,
                  label: t(`sales.kind.${kind}`),
                  valueLabel: `${formatMoney(kindRevenue(kind), locale)} · ${formatPercent(share, locale)}`,
                  share,
                  colorClassName: KIND_COLOR[kind],
                };
              })}
            />
          )}
        </ReportPanel>
      </div>
    </ReportsFrame>
  );
}
