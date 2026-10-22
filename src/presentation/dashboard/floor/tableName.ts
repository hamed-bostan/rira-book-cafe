import type { Locale } from "@/src/i18n/routing";
import { formatNumber } from "@/src/lib/formatNumber";

/**
 * The values for the `floorTables.tableName` message: the raw label picks the
 * wording ("Long table" for `long`), and a numbered table's number is formatted
 * for the locale (Persian digits under `fa`).
 */
export function tableNameValues(label: string, locale: Locale): { label: string; number: string } {
  return { label, number: /^\d+$/.test(label) ? formatNumber(Number(label), locale) : label };
}
