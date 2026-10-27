import { cn } from "@/src/lib/utils";

export type ShareBarRow = {
  key: string;
  label: string;
  /** "1,840,000 Toman · 64%" — the amount and its share, formatted by the caller. */
  valueLabel: string;
  /** The share of the whole, 0–1. */
  share: number;
  /** The bar's fill, one hue per row: `bg-primary`, `bg-info-foreground`, … */
  colorClassName: string;
};

/**
 * A small split as labelled horizontal bars — drinks, food and books, or how
 * orders were paid. Plain markup rather than a chart: three rows read faster as text.
 */
export function ShareBars({ rows }: { rows: readonly ShareBarRow[] }) {
  return (
    <ul className="flex flex-col gap-4">
      {rows.map((row) => (
        <li key={row.key} className="flex flex-col gap-1.5">
          <div className="flex flex-wrap justify-between gap-x-3 gap-y-1 text-body-default sm:text-body-small">
            <span className="font-medium text-foreground">{row.label}</span>
            <span className="whitespace-nowrap text-foreground/80 tabular-nums">{row.valueLabel}</span>
          </div>
          <div aria-hidden className="h-2 overflow-hidden rounded-full bg-muted">
            <div className={cn("h-full rounded-full", row.colorClassName)} style={{ width: `${row.share * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
