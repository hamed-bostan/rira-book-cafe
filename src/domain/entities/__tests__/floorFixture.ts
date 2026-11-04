import type { CafeTable } from "../CafeTable";

/**
 * The floor the cafe opened with (the migration copies it in): what the unit tests
 * seat bookings at and hold for events.
 */
export const FLOOR_TABLES: CafeTable[] = [
  { label: "1", seats: 2 },
  { label: "2", seats: 2 },
  { label: "3", seats: 4 },
  { label: "4", seats: 4 },
  { label: "5", seats: 4 },
  { label: "6", seats: 6 },
  { label: "7", seats: 6 },
  { label: "8", seats: 8 },
  { label: "long", seats: 12 },
].map((table, position) => ({ id: `t${position + 1}`, ...table, isActive: true, position }));

/** A table repository holding that floor — the read side the booking and event use-cases need. */
export const FLOOR = { listAll: async (): Promise<CafeTable[]> => FLOOR_TABLES };
