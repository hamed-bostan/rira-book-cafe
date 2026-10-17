import type { LedgerHook } from "./ILedgerRepository";
import type { CashShift, ShiftMovements } from "../entities/CashShift";

export type OpenShiftInput = {
  openingFloat: number;
  note?: string;
  by: { id: string; name: string };
};

export type CloseShiftInput = {
  countedCash: number;
  note?: string;
  by: { id: string; name: string };
  at: Date;
};

export type ICashShiftRepository = {
  /** The shift that's open now, if any. */
  getOpen(): Promise<CashShift | null>;
  getById(id: string): Promise<CashShift | null>;
  /** Recent shifts, newest first. */
  list(limit: number): Promise<CashShift[]>;
  /** Open a shift. Refused when one is already open (`ConflictError("SHIFT_ALREADY_OPEN")`). */
  open(input: OpenShiftInput): Promise<CashShift>;
  /** What the books moved between two instants (the shift's own over/short entry excluded). */
  movements(from: Date, to: Date): Promise<ShiftMovements>;
  /**
   * Close an open shift: compute what the drawer should hold from the books, record
   * the count and the difference, and post what `ledger` builds from the closed
   * shift — all in one transaction, serialized against a second close.
   * `ConflictError("NO_OPEN_SHIFT")` when it's already closed.
   */
  close(id: string, input: CloseShiftInput, ledger?: LedgerHook<CashShift>): Promise<CashShift>;
};
