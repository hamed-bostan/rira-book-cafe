import type en from "@/messages/en.json";
import type { StockItem, StockMovement } from "@/src/domain/entities/Inventory";
import { jalaliDayLabel } from "@/src/domain/entities/JalaliCalendar";
import type { Locale } from "@/src/i18n/routing";

import type { CsvCell } from "../csv";

/** The Inventory screen's copy, which the file's headings and kinds are read from. */
export type InventoryMessages = (typeof en)["dashInventory"];

/** Every label used here is plain text, so the catalog is read without a translator. */
export async function inventoryMessages(locale: Locale): Promise<InventoryMessages> {
  const catalog = (await import(`../../../messages/${locale}.json`)) as {
    default: { dashInventory: InventoryMessages };
  };
  return catalog.default.dashInventory;
}

/**
 * The stock movements as spreadsheet rows, oldest first, in the reader's language:
 * the day (and its Persian date in fa), item, kind, reason, signed quantity and
 * unit, then value — only when the reader may see costs — the running balance
 * when there is one, the note and who recorded it.
 */
export function movementRows(
  movements: readonly StockMovement[],
  units: ReadonlyMap<string, StockItem["unit"]>,
  messages: InventoryMessages,
  locale: Locale,
  costsVisible: boolean,
): CsvCell[][] {
  const csv = messages.movements.csv;
  const withBalance = movements.some((movement) => movement.balanceAfter !== undefined);
  const header: CsvCell[] = [
    csv.date,
    ...(locale === "fa" ? [csv.persianDate] : []),
    csv.item,
    csv.kind,
    csv.reason,
    csv.quantity,
    csv.unit,
    ...(costsVisible ? [csv.value] : []),
    ...(withBalance ? [csv.balance] : []),
    csv.note,
    csv.by,
  ];
  const rows = movements.map((movement): CsvCell[] => [
    movement.date,
    ...(locale === "fa" ? [jalaliDayLabel(movement.date)] : []),
    movement.ingredientName,
    messages.kind[movement.kind],
    movement.reason ? messages.adjust.reason[movement.reason] : undefined,
    movement.quantity,
    messages.unit[units.get(movement.ingredientId) ?? "piece"],
    ...(costsVisible ? [movement.value] : []),
    ...(withBalance ? [movement.balanceAfter] : []),
    movement.note,
    movement.createdByName,
  ]);
  return [header, ...rows];
}
