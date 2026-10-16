import type { AuditHook } from "./AuditHook";
import type { SuiteBooking, SuiteBookingStatus, SuiteBusyRange } from "../entities/SuiteBooking";

/** A stay about to be requested. Id, reference, status and timestamps are the repository's. */
export type NewSuiteBooking = Omit<SuiteBooking, "id" | "reference" | "status" | "createdAt" | "updatedAt">;

export type ISuiteBookingRepository = {
  /**
   * Record a request. Refuses dates that overlap a stay already holding the suite
   * (`ConflictError("SUITE_TAKEN")`) — a guest shouldn't be able to ask for nights
   * that are already given away.
   */
  create(input: NewSuiteBooking): Promise<SuiteBooking>;
  getById(id: string): Promise<SuiteBooking | null>;
  /** One guest's stays, soonest check-in first. */
  listForUser(userId: string): Promise<SuiteBooking[]>;
  /** Stays that end after `fromDay` (cafe day), in check-in order, optionally narrowed to one status. */
  listFrom(fromDay: string, status?: SuiteBookingStatus): Promise<SuiteBooking[]>;
  /** The nights already held from `fromDay` on — no names, for the public calendar. */
  listBusyFrom(fromDay: string): Promise<SuiteBusyRange[]>;
  /**
   * Move a stay to a new status, guarded on `expectedStatus`
   * (`ConflictError("INVALID_TRANSITION")`). When the new status holds the suite,
   * refuses a stay that overlaps another one holding it (`ConflictError("SUITE_TAKEN")`)
   * — checked and written in one transaction under a lock, so two staff can't both
   * give the same nights away.
   */
  applyStatus(
    id: string,
    expectedStatus: SuiteBookingStatus,
    status: SuiteBookingStatus,
    audit?: AuditHook<SuiteBooking>,
  ): Promise<SuiteBooking>;
};
