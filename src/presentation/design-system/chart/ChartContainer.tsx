"use client";

import * as React from "react";
import { ResponsiveContainer } from "recharts";

import { cn } from "@/src/lib/utils";

export type ChartContainerProps = {
  /** A single Recharts chart element (`BarChart`, `LineChart`, …) — `ResponsiveContainer` needs exactly one. */
  children: React.ReactElement;
  /** Chart height in pixels. Width always tracks the parent. */
  height?: number;
  className?: string;
  /**
   * Text direction for the chart's own DOM (axis ticks, tooltip, legend) — pass
   * the page's `getLangDir(locale)` result so a Persian chart mirrors instead of
   * silently staying LTR inside an RTL page.
   */
  dir?: "ltr" | "rtl";
};

/**
 * The responsive wrapper every chart mounts into.
 *
 * Recharts measures its parent synchronously on mount, so the parent needs an
 * explicit height — a chart in a `height: auto` box measures zero and never
 * renders. That measurement only happens in the browser, hence `"use client"`:
 * a chart is the one design-system surface that can't stay a Server Component.
 */
export function ChartContainer({ children, height = 240, className, dir }: ChartContainerProps) {
  return (
    <div
      dir={dir}
      className={cn("w-full", className)}
      style={{ height }}
      onMouseDownCapture={(event) => {
        // Recharts makes its root SVG keyboard-focusable. Keep that useful
        // keyboard behavior, but do not move focus there on a pointer click;
        // otherwise browsers draw a focus outline around the entire plot.
        if (event.button === 0) event.preventDefault();
      }}
    >
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  );
}
