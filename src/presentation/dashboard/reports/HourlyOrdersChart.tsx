"use client";

import { useLocale } from "next-intl";
import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from "recharts";

import { formatNumber } from "@/src/lib/formatNumber";
import { ChartContainer, ChartTooltip } from "@/src/presentation/design-system/chart";

type HourlyOrdersChartProps = {
  hourly: { hour: number; orders: number }[];
  labels: { heading: string; description: string; orders: string; empty: string };
};

/** First and last hour with any orders, so the chart shows opening hours, not 24 empty slots. */
function busySpan(hourly: { hour: number; orders: number }[]): [number, number] {
  const busy = hourly.filter((point) => point.orders > 0).map((point) => point.hour);
  if (busy.length === 0) return [8, 22];
  return [Math.min(...busy), Math.max(...busy)];
}

/** Completed orders by the hour they were placed, on the cafe's clock — when to staff up. */
export function HourlyOrdersChart({ hourly, labels }: HourlyOrdersChartProps) {
  const locale = useLocale();
  const [first, last] = busySpan(hourly);
  const rows = hourly
    .filter((point) => point.hour >= first && point.hour <= last)
    .map((point) => ({ label: formatNumber(point.hour, locale), orders: point.orders }));
  const hasData = rows.some((row) => row.orders > 0);

  return (
    <section className="min-w-0 rounded-card-lg border border-border bg-background p-4 md:p-6">
      <h2 className="text-body-lead text-foreground">{labels.heading}</h2>
      <p className="text-body-small text-muted-foreground">{labels.description}</p>
      {hasData ? (
        <div className="mt-4" aria-hidden>
          <ChartContainer height={180} dir="ltr">
            <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--color-border)" />
              <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }} />
              <YAxis axisLine={false} tickLine={false} width={32} allowDecimals={false} tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }} />
              <Tooltip
                cursor={{ fill: "var(--color-muted)" }}
                content={(props) => (
                  <ChartTooltip
                    {...props}
                    renderContent={() => {
                      const row = props.payload?.[0]?.payload as { label: string; orders: number } | undefined;
                      return row ? <p className="text-foreground">{row.label}:00 · {labels.orders}: {formatNumber(row.orders, locale)}</p> : null;
                    }}
                  />
                )}
              />
              <Bar dataKey="orders" fill="var(--color-chart-2)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ChartContainer>
        </div>
      ) : (
        <p className="py-12 text-center text-body-small-emphasis text-muted-foreground">{labels.empty}</p>
      )}
      <p className="sr-only">
        {labels.heading}: {rows.map((row) => `${row.label}:00, ${row.orders}`).join("; ")}
      </p>
    </section>
  );
}
