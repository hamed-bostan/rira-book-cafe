"use client";

import * as React from "react";

import { cn } from "@/src/lib/utils";

import type { DefaultLegendContentProps, LegendPayload } from "recharts";

export type ChartLegendProps = DefaultLegendContentProps & { className?: string };

/**
 * The legend row every multi-series chart shares — pass it straight as a
 * Recharts `<Legend content={...}>` render function. A colour dot plus label per
 * series, styled off `muted-foreground` rather than Recharts' inline defaults.
 */
export function ChartLegend({ payload, className }: ChartLegendProps) {
  if (!payload || payload.length === 0) return null;

  return (
    <ul className={cn("flex flex-wrap items-center justify-center gap-x-4 gap-y-1", className)}>
      {payload.map((entry: LegendPayload, index) => (
        <li key={entry.dataKey ? String(entry.dataKey) : index} className="flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-body-small-strong text-muted-foreground">{entry.value}</span>
        </li>
      ))}
    </ul>
  );
}
