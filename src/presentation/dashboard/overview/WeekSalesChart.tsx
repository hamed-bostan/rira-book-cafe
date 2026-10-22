"use client";

import { useLocale, useTranslations } from "next-intl";
import * as React from "react";

import { Link } from "@/src/i18n/navigation";
import { formatMoney, moneyUnit } from "@/src/lib/formatMoney";
import { formatCompactNumber, formatNumber } from "@/src/lib/formatNumber";
import { cn } from "@/src/lib/utils";
import { focusRing } from "@/src/presentation/design-system/components/shared/focusRing";

import { OverviewSegmented } from "./OverviewSegmented";

/** One day's bar, labelled on the server so the dates follow the cafe's calendar. */
export type WeekSalesDay = {
  /** Under the bar: "Thu 15", or "Today" for the last one. */
  label: string;
  /** The tooltip's heading: "Thursday, Oct 15". */
  title: string;
  revenue: number;
  orders: number;
};

type Metric = "revenue" | "orders";

/** Gridlines above the baseline. */
const Y_TICKS = 3;
/** Multipliers a tick step snaps to, so the axis reads 0 · 4M · 8M · 12M rather than 0 · 3.7M · … */
const NICE_STEPS = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];

function niceStep(max: number): number {
  const raw = max / Y_TICKS || 1;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  return (NICE_STEPS.find((multiple) => multiple * magnitude >= raw) ?? 10) * magnitude;
}

type WeekSalesChartProps = {
  /** Seven days, oldest first; the last is today, still in progress. */
  days: WeekSalesDay[];
};

/**
 * The last seven days as bars — takings or orders. One series, one hue: today's
 * bar is the lighter tint because the day isn't over, so it doesn't read as a dip.
 * Hovering a bar shows its exact figure; the whole series is also written out for
 * screen readers, since the bars themselves are decoration.
 */
export function WeekSalesChart({ days }: WeekSalesChartProps) {
  const t = useTranslations("dashOverview");
  const locale = useLocale();
  const [metric, setMetric] = React.useState<Metric>("revenue");
  const [hovered, setHovered] = React.useState<number | null>(null);

  const revenue = metric === "revenue";
  const values = days.map((day) => day[metric]);
  const step = niceStep(Math.max(...values));
  const max = step * Y_TICKS;
  const total = values.reduce((sum, value) => sum + value, 0);
  const formatValue = (value: number): string =>
    revenue ? formatMoney(value, locale) : t("ordersCount", { count: value });

  return (
    <section
      aria-labelledby="overview-week"
      className="flex min-w-0 flex-col gap-6 rounded-card-lg border border-border bg-background p-5 shadow-xs"
    >
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="flex flex-col gap-1">
          <h2 id="overview-week" className="text-body-strong text-foreground">
            {t("weekHeading")}
          </h2>
          <p className="flex items-baseline gap-1.5">
            <span className="text-heading-subsection tracking-tight text-foreground tabular-nums sm:text-heading-section">
              {formatNumber(total, locale)}
            </span>
            <span className="text-body-default font-medium text-muted-foreground sm:text-body-small">
              {revenue ? moneyUnit(locale) : t("ordersUnit")}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <OverviewSegmented
            label={t("chartMetric")}
            value={metric}
            onChange={(next) => {
              setMetric(next);
              setHovered(null);
            }}
            options={[
              { value: "revenue", label: t("metricRevenue") },
              { value: "orders", label: t("metricOrders") },
            ]}
          />
          <Link
            href="/dashboard/reports/sales?range=7d"
            className={cn(
              "-my-3 py-3 text-body-small-emphasis whitespace-nowrap text-primary transition-colors hover:text-primary-hover sm:my-0 sm:py-0",
              focusRing,
            )}
          >
            {t("viewReport")}
          </Link>
        </div>
      </div>

      <div aria-hidden className="flex gap-3">
        {/* The y-axis: tick labels centred on their gridlines. */}
        <div className="relative h-48 w-8 shrink-0">
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
            <div className="absolute inset-0 flex items-end gap-2">
              {days.map((day, index) => {
                const value = day[metric];
                const height = value ? `${Math.max(1, (value / max) * 100)}%` : "0%";
                const isToday = index === days.length - 1;
                const isHovered = hovered === index;
                return (
                  <div
                    key={day.label}
                    onMouseEnter={() => setHovered(index)}
                    className="relative flex h-full min-w-0 flex-1 items-end justify-center"
                  >
                    <div
                      style={{ height }}
                      className={cn(
                        "w-full max-w-12 rounded-t-badge-md transition-colors",
                        isToday
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
                        <span className="text-body-caption text-muted-foreground">{day.title}</span>
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
          <div className="flex gap-2">
            {days.map((day, index) => (
              <span
                key={day.label}
                className={cn(
                  "min-w-0 flex-1 truncate text-center text-body-caption",
                  index === days.length - 1 ? "font-semibold text-foreground" : "text-muted-foreground",
                )}
              >
                {day.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      <p className="sr-only">
        {t("chartSummary", {
          days: days.map((day) => `${day.title}: ${formatValue(day[metric])}`).join("; "),
        })}
      </p>
    </section>
  );
}
