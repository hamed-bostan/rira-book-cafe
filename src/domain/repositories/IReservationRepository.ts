import type { AuditHook } from "./AuditHook";
import type { ActivityActor } from "../entities/ActivityEntry";
import type { Reservation, ReservationStatus } from "../entities/Reservation";

/** A booking about to be made. Id, reference, status and timestamps are the repository's. */
export type NewReservation = Omit<
  Reservation,
  "id" | "reference" | "status" | "tableLabel" | "createdAt" | "updatedAt"
>;

/** What a staff change sets: the new status, and optionally the table (`null` clears it). */
export type ReservationChange = {
  status: ReservationStatus;
  tableLabel?: string | null;
};

export type IReservationRepository = {
  create(input: NewReservation): Promise<Reservation>;
  getById(id: string): Promise<Reservation | null>;
  /** One guest's reservations, soonest first. */
  listForUser(userId: string): Promise<Reservation[]>;
  /** Reservations starting within `[from, to)`, in start order, optionally narrowed to one status. */
  listBetween(from: Date, to: Date, status?: ReservationStatus): Promise<Reservation[]>;
  /**
   * Apply a staff change, guarded on `expectedStatus` so a concurrent change can't
   * be overwritten (`ConflictError("INVALID_TRANSITION")`). When the result holds a
   * table, the repository refuses a table already held by another overlapping
   * booking (`ConflictError("TABLE_TAKEN")`) — checked and written in one
   * transaction so two staff can't both give away the same table.
   */
  applyChange(
    id: string,
    expectedStatus: ReservationStatus,
    change: ReservationChange,
    actor: ActivityActor,
    audit?: AuditHook<Reservation>,
  ): Promise<Reservation>;
};
