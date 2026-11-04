import type { AuditHook } from "./AuditHook";
import type { CafeTable } from "../entities/CafeTable";

/** A table as staff fill it in; its place in floor order is the repository's to give. */
export type NewCafeTable = Pick<CafeTable, "label" | "seats" | "area" | "isActive">;

/** The cafe's tables — the floor plan every booking, event hold and picker reads. */
export type ICafeTableRepository = {
  /** Every table, in use or not, in floor order. */
  listAll(): Promise<CafeTable[]>;
  getById(id: string): Promise<CafeTable | null>;
  /** Added at the end of the floor. `UniqueConstraintError` (`label`) when the label is taken. */
  create(input: NewCafeTable, audit?: AuditHook<CafeTable>): Promise<CafeTable>;
  /**
   * Change a table. A new label is carried onto every booking and event hold that
   * names the old one, in the same transaction, so nothing loses its table.
   * `NotFoundError` for an unknown id; `UniqueConstraintError` (`label`) when the
   * new label is another table's.
   */
  update(id: string, input: NewCafeTable, audit?: AuditHook<CafeTable>): Promise<CafeTable>;
  /** Write the floor order: `ids` from first to last, every table once. */
  setOrder(ids: readonly string[], audit?: AuditHook<void>): Promise<void>;
  /**
   * Remove a table nothing still needs. `ResourceInUseError` while a dine-in order
   * at it is open, a booking holds it from `now` on, or an event that hasn't ended
   * holds it — take it out of use instead. `NotFoundError` for an unknown id.
   */
  delete(id: string, now: Date, audit?: AuditHook<CafeTable>): Promise<void>;
};
