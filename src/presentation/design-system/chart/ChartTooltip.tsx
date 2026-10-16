"use client";

import * as React from "react";

import { cn } from "@/src/lib/utils";

import type { TooltipContentProps } from "recharts";

export type ChartTooltipRenderArgs = {
  payload: TooltipContentProps["payload"];
  label?: TooltipContentProps["label"];
};

export type ChartTooltipProps = TooltipContentProps & {
  className?: string;
  /**
   * Full override of the tooltip body, for a chart whose "one series per row"
   * default doesn't fit (e.g. a single composed sentence per point). Falls back
   * to a row per series, each keyed by that series' own color.
   */
  renderContent?: (args: ChartTooltipRenderArgs) => React.ReactNode;
};

/**
 * The card every chart's hover tooltip renders into — pass it straight as a
 * Recharts `<Tooltip content={...}>` render function. Styled off `surface`/
 * `border` tokens rather than Recharts' inline-styled default, and RTL-aware
 * for free: it renders plain text with logical (`text-end`, flex) layout, which
 * already flips under the ambient `dir` set by `ChartContainer`.
 */
export function ChartTooltip({ active, payload, label, className, renderContent }: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div
      className={cn(
        "rounded-card-md border border-border bg-popover px-3 py-2 text-body-small-strong shadow-md",
        className,
      )}
    >
      {renderContent ? (
        renderContent({ payload, label })
      ) : (
        <>
          {label !== undefined && label !== null ? <p className="mb-1 text-muted-foreground">{label}</p> : null}
          <ul className="flex flex-col gap-1">
            {payload.map((entry, index) => (
              <li key={entry.dataKey ? String(entry.dataKey) : index} className="flex items-center gap-2">
                <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ backgroundColor: entry.color }} />
                <span className="min-w-0 flex-1 truncate text-foreground">{entry.name}</span>
                <span className="text-end font-medium text-foreground">{entry.value}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
