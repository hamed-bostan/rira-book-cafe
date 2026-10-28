"use client";

import { useLocale, useTranslations } from "next-intl";
import * as React from "react";

import { formatMoney } from "@/src/lib/formatMoney";
import { formatCompactNumber, formatNumber } from "@/src/lib/formatNumber";
import { cn } from "@/src/lib/utils";

import { OverviewSegmented } from "../overview/OverviewSegmented";

import { chartTickStep, Y_TICKS, type SalesChartKind } from "./salesChart";

/** One bar, labelled on the server so dates and hours follow the cafe's calendar and clock. */
export type ReportChartBar = {
  /** Under the bar — empty on a dense chart where only every few bars are labelled. */
  label: string;
  /** The tooltip's heading: "Thu, Oct 15", "Week of Oct 6", "3:00 PM – 4:00 PM". */
  title: string;
  revenue: number;
  orders: number;
  /** Still in progress — drawn in the lighter tint. */
  soft: boolean;
};

type Metric = "revenue" | "orders";

/** Past this many bars they sit closer together. */
const DENSE_BARS = 14;

type ReportSalesChartProps = {
  kind: SalesChartKind;
  /** Oldest first. */
  bars: ReportChartBar[];
};

/**
 * The range's sales as bars — revenue or orders: by the hour for one day, by the
 * day up to a month, by the week beyond. One series, one hue; the bar still
 * filling up is the lighter tint. Hovering a bar shows its exact figure; the whole
 * series is also written out for screen readers, since the bars are decoration.
 */
export function ReportSalesChart({ kind, bars }: ReportSalesChartProps) {
  const t = useTranslations("dashReports");
  const locale = useLocale();
  const [metric, setMetric] = React.useState<Metric>("revenue");
  const [hovered, setHovered] = React.useState<number | null>(null);

  const revenue = metric === "revenue";
  const step = chartTickStep(Math.max(0, ...bars.map((bar) => bar[metric])));
  const max = step * Y_TICKS;
  const dense = bars.length > DENSE_BARS;
  const formatValue = (value: number): string =>
    revenue ? formatMoney(value, locale) : t("orderCount", { count: value, formatted: formatNumber(value, locale) });
  const heading = t(`sales.chart.${kind}`);
  const description =
    kind === "hourly"
      ? t("sales.chartHourlyDescription")
      : revenue
        ? t("sales.chartRevenueDescription")
        : t("sales.chartOrdersDescription");

  return (
    <section
      aria-label={heading}
      className="flex min-w-0 flex-col gap-6 rounded-card-lg border border-border bg-background p-5 shadow-xs"
    >
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="text-body-strong text-foreground">{heading}</h2>
          <p className="text-body-small text-muted-foreground sm:text-body-caption">{description}</p>
        </div>
        <OverviewSegmented
          label={t("sales.chartMetric")}
          value={metric}
          onChange={(next) => {
            setMetric(next);
            setHovered(null);
          }}
          options={[
            { value: "revenue", label: t("sales.revenue") },
            { value: "orders", label: t("sales.orders") },
          ]}
        />
      </div>

      <div aria-hidden className="flex gap-3">
        {/* The y-axis: tick labels centred on their gridlines. */}
        <div className="relative h-48 w-10 shrink-0">
          {Array.from({ length: Y_TICKS + 1 }, (_, index) => (
            <span
              key={index}
              style={{ bottom: `${(index / Y_TICKS) * 100}%` }}
              className="absolute end-0 translate-y-1/2 text-body-caption whitespace-nowrap text-muted-foreground tabular-nums"
            >
              {revenue ? formatCompactNumber(step * index, locale) : formatNumber(step * index, locale)}
            </span>
          ))}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="relative h-48" onMouseLeave={() => setHovered(null)}>
            {Array.from({ length: Y_TICKS + 1 }, (_, index) => (
              <div
                key={index}
                style={{ bottom: `${(index / Y_TICKS) * 100}%` }}
                className="absolute inset-x-0 border-t border-border"
              />
            ))}
            <div className={cn("absolute inset-0 flex items-end", dense ? "gap-1" : "gap-2")}>
              {bars.map((bar, index) => {
                const value = bar[metric];
                const height = value ? `${Math.max(1, (value / max) * 100)}%` : "0%";
                const isHovered = hovered === index;
                return (
                  <div
                    key={bar.title}
                    onMouseEnter={() => setHovered(index)}
                    className="relative flex h-full min-w-0 flex-1 items-end justify-center"
                  >
                    <div
                      style={{ height }}
                      className={cn(
                        "w-full max-w-12 rounded-t-badge-md transition-colors",
                        bar.soft
                          ? isHovered
                            ? "bg-primary"
                            : "bg-accent-border"
                          : isHovered
                            ? "bg-primary-hover"
                            : "bg-primary",
                      )}
                    />
                    {isHovered ? (
                      <div
                        style={{ bottom: `calc(${height} + 0.5rem)` }}
                        className="pointer-events-none absolute start-1/2 z-10 flex -translate-x-1/2 flex-col gap-0.5 rounded-badge-md border border-border bg-background px-3 py-2 whitespace-nowrap shadow-lg rtl:translate-x-1/2"
                      >
                        <span className="text-body-caption text-muted-foreground">{bar.title}</span>
                        <span className="text-body-small-strong text-foreground tabular-nums">
                          {formatValue(value)}
                        </span>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
          <div className={cn("flex", dense ? "gap-1" : "gap-2")}>
            {bars.map((bar) => (
              <span
                key={bar.title}
                className="min-w-0 flex-1 text-center text-body-caption whitespace-nowrap text-muted-foreground"
              >
                {bar.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      <p className="sr-only">
        {t("sales.chartSummary", {
          heading,
          points: bars.map((bar) => `${bar.title}: ${formatValue(bar[metric])}`).join("; "),
        })}
      </p>
    </section>
  );
}
