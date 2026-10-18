import { ChartPie } from "lucide-react";

import { EmptyState } from "@/src/presentation/design-system";
import { chartColor } from "@/src/presentation/design-system/chart";

type ShareBarsProps = {
  heading: string;
  rows: { key: string; label: string; value: number; valueLabel: string; detail?: string }[];
  empty: string;
};

/**
 * A small split as labelled horizontal bars — drinks vs food vs books, dine-in vs
 * takeaway. Plain markup rather than a chart: three rows read faster as text.
 */
export function ShareBars({ heading, rows, empty }: ShareBarsProps) {
  const total = rows.reduce((sum, row) => sum + row.value, 0);

  return (
    <section className="min-w-0 rounded-card-lg border border-border bg-background p-4 md:p-6">
      <h2 className="text-body-lead text-foreground">{heading}</h2>
      {total === 0 ? (
        <EmptyState icon={ChartPie} title={empty} className="py-8" />
      ) : (
        <ul className="mt-4 flex flex-col gap-4">
          {rows.map((row, index) => {
            const share = row.value / total;
            return (
              <li key={row.key} className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between gap-3 text-body-small">
                  <span className="text-foreground">{row.label}</span>
                  <span className="text-end">
                    <span className="text-body-small-emphasis text-foreground">{row.valueLabel}</span>
                    {row.detail ? <span className="ms-2 text-muted-foreground">{row.detail}</span> : null}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${Math.max(share * 100, 2)}%`, backgroundColor: chartColor(index) }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
