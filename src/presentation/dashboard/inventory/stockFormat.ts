import { roundQuantity } from "@/src/domain/entities/Inventory";
import type { Locale } from "@/src/i18n/routing";
import { formatNumber } from "@/src/lib/formatNumber";

/** Average costs per gram or millilitre can be fractions of a Toman; two places are enough to compare them. */
const UNIT_COST_DECIMALS = 2;
/** Quantities are kept to three places (grams, millilitres). */
const QUANTITY_DECIMALS = 3;

/** How many decimals `value` actually carries, up to `max` — "24", not "24.000". */
function decimalsOf(value: number, max: number): number {
  const fraction = value.toFixed(max).split(".")[1] ?? "";
  return fraction.replace(/0+$/, "").length;
}

/** A stock quantity with only the decimals it has: "24", "8.4", "0.125". */
export function formatStockQuantity(value: number, locale: Locale): string {
  const rounded = roundQuantity(value);
  return formatNumber(rounded, locale, decimalsOf(rounded, QUANTITY_DECIMALS));
}

/** What one unit costs, in Toman — whole for most items, to two places for a gram of saffron. */
export function formatUnitCost(value: number, locale: Locale): string {
  return formatNumber(value, locale, value >= 100 ? 0 : decimalsOf(value, UNIT_COST_DECIMALS));
}
