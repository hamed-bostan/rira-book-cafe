import type { AuditHook } from "./AuditHook";
import type { LedgerHook } from "./ILedgerRepository";
import type { Reservation } from "../entities/Reservation";
import type { ReservationDeposit, ReservationDepositSettlement } from "../entities/ReservationDeposit";

/**
 * Money held against a table booking. Each write posts its entry and its audit
 * entry in the same transaction as the booking row, guarded on the row as the
 * caller read it — a concurrent change makes the write refuse
 * (`ConflictError("INVALID_TRANSITION")`) rather than book money twice.
 */
export type IReservationDepositRepository = {
  /** Record a deposit on a booking that's still on (`DEPOSIT_TAKING_STATUSES`) and has none. */
  takeDeposit(
    id: string,
    deposit: Omit<ReservationDeposit, "state">,
    ledger: LedgerHook<Reservation>,
    audit?: AuditHook<Reservation>,
  ): Promise<Reservation>;
  /** Hand a held deposit back, or keep it, once the booking is over (`DEPOSIT_SETTLING_STATUSES`). */
  settleDeposit(
    id: string,
    to: ReservationDepositSettlement,
    ledger: LedgerHook<Reservation>,
    audit?: AuditHook<Reservation>,
  ): Promise<Reservation>;
};
