"use client";

import { BarChart3 } from "lucide-react";
import { useLocale } from "next-intl";
import * as React from "react";
import { Bar, BarChart, CartesianGrid, ComposedChart, Line, Tooltip, XAxis, YAxis } from "recharts";

import { formatCafeDayShort } from "@/src/lib/formatCafeDay";
import { formatMoney } from "@/src/lib/formatMoney";
import { formatNumber } from "@/src/lib/formatNumber";
import { ChartSegmentedControl } from "@/src/presentation/dashboard/ChartSegmentedControl";
import { ChartContainer, ChartTooltip, EmptyState } from "@/src/presentation/design-system";

type Metric = "revenue" | "orders";

type DailySalesChartProps = {
  daily: { day: string; revenue: number; orders: number }[];
  /** The previous period, aligned by position, drawn as a dashed line. */
  previousDaily?: { day: string; revenue: number; orders: number }[];
  labels: { heading: string; revenue: string; orders: string; current: string; previous: string; empty: string };
};

type Row = { label: string; current: number; previous: number };

/**
 * Completed sales per cafe day: bars for this period, a dashed line for the one
 * before it (aligned day 1 to day 1). Toggles between revenue and order count.
 */
export function DailySalesChart({ daily, previousDaily, labels }: DailySalesChartProps) {
  const locale = useLocale();
  const [metric, setMetric] = React.useState<Metric>("revenue");

  const rows: Row[] = daily.map((point, index) => ({
    label: formatCafeDayShort(point.day, locale),
    current: point[metric],
    previous: previousDaily?.[index]?.[metric] ?? 0,
  }));
  const hasData = rows.some((row) => row.current > 0 || row.previous > 0);
  const format = (value: number) => (metric === "revenue" ? formatMoney(value, locale) : formatNumber(value, locale));
  // Compact axis labels: "185K" / «۱۸۵ هزار», so long Toman amounts fit the gutter.
  const compact = new Intl.NumberFormat(locale === "fa" ? "fa-IR" : "en-US", { notation: "compact", maximumFractionDigits: 1 });
  const axis = (value: number) => (metric === "revenue" ? compact.format(value) : formatNumber(value, locale));

  return (
    <section className="min-w-0 rounded-card-lg border border-border bg-background p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-body-lead text-foreground">{labels.heading}</h2>
        <ChartSegmentedControl
          value={metric}
          options={["revenue", "orders"]}
          label={labels.heading}
          onChange={setMetric}
          getLabel={(value) => (value === "revenue" ? labels.revenue : labels.orders)}
          emphasis
        />
      </div>
      {hasData ? (
        <div className="mt-4" aria-hidden>
          <ChartContainer height={220} dir="ltr">
            {previousDaily ? (
              <ComposedChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--color-border)" />
                <XAxis dataKey="label" axisLine={false} tickLine={false} interval="preserveStartEnd" tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }} />
                <YAxis axisLine={false} tickLine={false} width={64} tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }} tickFormatter={axis} />
                <Tooltip
                  cursor={{ fill: "var(--color-muted)" }}
                  content={(props) => (
                    <ChartTooltip
                      {...props}
                      renderContent={() => {
                        const row = props.payload?.[0]?.payload as Row | undefined;
                        return row ? (
                          <div className="space-y-1">
                            <p className="font-semibold text-foreground">{row.label}</p>
                            <p className="text-primary">{labels.current}: {format(row.current)}</p>
                            <p className="text-muted-foreground">{labels.previous}: {format(row.previous)}</p>
                          </div>
                        ) : null;
                      }}
                    />
                  )}
                />
                <Bar dataKey="current" fill="var(--color-primary)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                <Line type="monotone" dataKey="previous" stroke="var(--color-chart-6)" strokeWidth={1.5} strokeDasharray="5 5" dot={false} isAnimationActive={false} />
              </ComposedChart>
            ) : (
              <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--color-border)" />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }} />
                <YAxis axisLine={false} tickLine={false} width={64} tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }} tickFormatter={axis} />
                <Bar dataKey="current" fill="var(--color-primary)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
              </BarChart>
            )}
          </ChartContainer>
        </div>
      ) : (
        <EmptyState icon={BarChart3} title={labels.empty} />
      )}
      {/* The chart is decorative for screen readers; this is the data. */}
      <p className="sr-only">
        {labels.heading}: {rows.map((row) => `${row.label}, ${format(row.current)}`).join("; ")}
      </p>
    </section>
  );
}
