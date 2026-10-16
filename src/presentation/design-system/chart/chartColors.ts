/**
 * Categorical ramp for chart series, as CSS variable references — never literal
 * hex in chart code, so a chart's palette stays the same system as everything
 * else (see `tokens/semantic/colors.ts`).
 */
export const CHART_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
  "var(--color-chart-6)",
] as const;

/** A series color by position, wrapping if there are more series than ramp steps. */
export function chartColor(index: number): string {
  return CHART_COLORS[index % CHART_COLORS.length];
}
