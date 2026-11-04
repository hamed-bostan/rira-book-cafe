/**
 * The cafe floor: every table a booking can be seated at or an event can hold.
 * Staff keep the list in the dashboard's settings (it used to be a constant). A
 * table's `label` is what staff write on a reservation (`Reservation.tableLabel`)
 * and what an event stores in `CafeEvent.tableLabels`, so the two clash-check
 * against each other by plain equality — which is why a rename carries the new
 * label onto the bookings and events that name the old one.
 */

export type CafeTable = {
  id: string;
  label: string;
  seats: number;
  /** Where on the floor it stands ("Window", "Terrace"), when staff group them. */
  area?: string;
  /**
   * Whether it can be given to a booking or held for an event now. A table taken
   * out of use keeps its history (and any booking already on it) but leaves the
   * pickers.
   */
  isActive: boolean;
  /** Its place in floor order, 0-based — the order the floor is walked and pickers list it. */
  position: number;
};

/** What the pickers and the clash checks need of a table. */
export type FloorTable = Pick<CafeTable, "label" | "seats" | "area">;

/** The same cap a dine-in order's table has, so a floor label always fits an order. */
export const MAX_CAFE_TABLE_LABEL_LENGTH = 20;
export const MIN_TABLE_SEATS = 1;
export const MAX_TABLE_SEATS = 40;
export const MAX_TABLE_AREA_LENGTH = 40;
/** Far beyond any one cafe floor; bounds the pickers and a hold-every-table request. */
export const MAX_CAFE_TABLES = 100;

/** The direction a table moves along the floor order. */
export type CafeTableMoveDirection = "up" | "down";

/** The tables in use now, in floor order — what every picker offers. */
export function activeFloor(tables: readonly CafeTable[]): FloorTable[] {
  return [...tables]
    .filter((table) => table.isActive)
    .sort((a, b) => a.position - b.position)
    .map(({ label, seats, area }) => (area ? { label, seats, area } : { label, seats }));
}

/** Whether `label` names a table on this floor. */
export function isFloorTable(floor: readonly FloorTable[], label: string): boolean {
  return floor.some((table) => table.label === label);
}

/** Total seats at the given tables; labels off the floor count for nothing. */
export function seatsAtTables(floor: readonly FloorTable[], labels: readonly string[]): number {
  const wanted = new Set(labels);
  return floor.reduce((sum, table) => sum + (wanted.has(table.label) ? table.seats : 0), 0);
}

/** The given tables without duplicates, in floor order; labels off the floor are dropped. */
export function inFloorOrder(floor: readonly FloorTable[], labels: readonly string[]): string[] {
  const wanted = new Set(labels);
  return floor.filter((table) => wanted.has(table.label)).map((table) => table.label);
}

/** Whether the tables cover the whole floor — shown as one "Whole floor" chip rather than every table. */
export function isWholeFloor(floor: readonly FloorTable[], labels: readonly string[]): boolean {
  return floor.length > 0 && inFloorOrder(floor, labels).length === floor.length;
}

/** Whether a seat count is one a table can have. */
export function isTableSeats(seats: number): boolean {
  return Number.isInteger(seats) && seats >= MIN_TABLE_SEATS && seats <= MAX_TABLE_SEATS;
}
