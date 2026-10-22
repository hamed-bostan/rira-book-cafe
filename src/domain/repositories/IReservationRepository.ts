import type { AuditHook } from "./AuditHook";
import type { ActivityActor } from "../entities/ActivityEntry";
import type { Reservation, ReservationStatus } from "../entities/Reservation";

/**
 * A booking about to be made. Id, reference, status and timestamps are the
 * repository's. With a `tableLabel` (staff booking a phone or walk-in guest at a
 * table) it's made `confirmed`; without, it's a `requested` booking.
 */
export type NewReservation = Omit<Reservation, "id" | "reference" | "status" | "createdAt" | "updatedAt">;

/** What a staff change sets: the new status, and optionally the table (`null` clears it). */
export type ReservationChange = {
  status: ReservationStatus;
  tableLabel?: string | null;
};

export type IReservationRepository = {
  /**
   * Record a booking. One made with a table refuses a table another booking or an
   * event holds then (`TABLE_TAKEN` / `TABLE_HELD`), under the same lock as `applyChange`.
   */
  create(input: NewReservation, audit?: AuditHook<Reservation>): Promise<Reservation>;
  getById(id: string): Promise<Reservation | null>;
  /** One guest's reservations, soonest first. */
  listForUser(userId: string): Promise<Reservation[]>;
  /** Reservations starting within `[from, to)`, in start order, optionally narrowed to one status. */
  listBetween(from: Date, to: Date, status?: ReservationStatus): Promise<Reservation[]>;
  /**
   * Apply a staff change, guarded on `expectedStatus` so a concurrent change can't
   * be overwritten (`ConflictError("INVALID_TRANSITION")`). When the result holds a
   * table, the repository refuses a table already held by another overlapping
   * booking (`ConflictError("TABLE_TAKEN")`) or held by an event running then
   * (`ConflictError("TABLE_HELD")`) — checked and written in one transaction so
   * two staff can't both give away the same table.
   */
  applyChange(
    id: string,
    expectedStatus: ReservationStatus,
    change: ReservationChange,
    actor: ActivityActor,
    audit?: AuditHook<Reservation>,
  ): Promise<Reservation>;
};
