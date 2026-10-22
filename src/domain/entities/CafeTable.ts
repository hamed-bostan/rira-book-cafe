/**
 * The cafe floor: every table a booking can be seated at or an event can hold.
 * A table's `label` is what staff write on a reservation (`Reservation.tableLabel`)
 * and what an event stores in `CafeEvent.tableLabels`, so the two clash-check
 * against each other by plain equality.
 */

export type CafeTable = {
  label: string;
  seats: number;
};

/** The floor plan, in the order the floor is walked (and pickers list it). */
export const CAFE_TABLES = [
  { label: "1", seats: 2 },
  { label: "2", seats: 2 },
  { label: "3", seats: 4 },
  { label: "4", seats: 4 },
  { label: "5", seats: 4 },
  { label: "6", seats: 6 },
  { label: "7", seats: 6 },
  { label: "8", seats: 8 },
  { label: "long", seats: 12 },
] as const satisfies readonly CafeTable[];

export type CafeTableLabel = (typeof CAFE_TABLES)[number]["label"];

export const CAFE_TABLE_LABELS = CAFE_TABLES.map((table) => table.label) as [CafeTableLabel, ...CafeTableLabel[]];

const SEATS_BY_LABEL: ReadonlyMap<string, number> = new Map(CAFE_TABLES.map((table) => [table.label, table.seats]));

export function isCafeTable(label: string): label is CafeTableLabel {
  return SEATS_BY_LABEL.has(label);
}

/** Total seats at the given tables; labels off the floor plan count for nothing. */
export function seatsAtTables(labels: readonly string[]): number {
  return labels.reduce((sum, label) => sum + (SEATS_BY_LABEL.get(label) ?? 0), 0);
}

/** The given tables without duplicates, in floor order; labels off the floor plan are dropped. */
export function inFloorOrder(labels: readonly string[]): CafeTableLabel[] {
  const wanted = new Set(labels);
  return CAFE_TABLE_LABELS.filter((label) => wanted.has(label));
}

/** Whether the tables cover the whole floor — shown as one "Whole floor" chip rather than every table. */
export function isWholeFloor(labels: readonly string[]): boolean {
  return inFloorOrder(labels).length === CAFE_TABLES.length;
}
