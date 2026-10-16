import { percentChange } from "@/src/domain/entities/Analytics";
import type { Locale } from "@/src/i18n/routing";
import { formatPercent } from "@/src/lib/formatCafeDay";

import type { StatCardProps } from "../StatCard";

/**
 * A stat card's change versus the previous period: "+12%" with an up arrow, or no
 * delta at all when there's no baseline to compare against (rather than a
 * misleading "+∞%").
 */
export function deltaProps(
  current: number,
  previous: number,
  locale: Locale,
  label: string,
): Pick<StatCardProps, "delta" | "deltaTone" | "deltaLabel"> {
  const change = percentChange(current, previous);
  if (change === null) return { deltaLabel: label };
  const tone = change > 0.005 ? "up" : change < -0.005 ? "down" : "flat";
  return { delta: formatPercent(Math.abs(change), locale), deltaTone: tone, deltaLabel: label };
}
