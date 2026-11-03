import type { AuditHook } from "./AuditHook";
import type { NewGuestProfile } from "../entities/GuestProfile";
import type { SuiteBooking, SuiteBookingStatus, SuiteBusyRange } from "../entities/SuiteBooking";

/** A stay about to be made, always for a guest's profile. Id, reference, status and timestamps are the repository's. */
export type NewSuiteBooking = Omit<
  SuiteBooking,
  "id" | "reference" | "status" | "createdAt" | "updatedAt" | "userId"
> & {
  userId: string;
  /** Staff booking for a guest whose phone has no profile yet: the profile, made with the stay. */
  newGuest?: NewGuestProfile;
};

/** A stay's days and party as staff edit them — the whole set, as it's to be after the save. */
export type SuiteStayEdit = Pick<SuiteBooking, "checkIn" | "checkOut" | "guests">;

export type ISuiteBookingRepository = {
  /**
   * Record a stay — a guest's request, or (`confirmed`) one staff booked for a
   * guest. Refuses dates that overlap a stay already holding the suite
   * (`ConflictError("SUITE_TAKEN")`), under the suite's lock — nobody can ask for or
   * be given nights that are already gone. With `newGuest`, the guest's profile is
   * made in the same transaction.
   */
  create(
    input: NewSuiteBooking,
    status?: "requested" | "confirmed",
    audit?: AuditHook<SuiteBooking>,
  ): Promise<SuiteBooking>;
  getById(id: string): Promise<SuiteBooking | null>;
  /** One guest's stays, soonest check-in first. */
  listForUser(userId: string): Promise<SuiteBooking[]>;
  /** Stays that end after `fromDay` (cafe day), in check-in order, optionally narrowed to one status. */
  listFrom(fromDay: string, status?: SuiteBookingStatus): Promise<SuiteBooking[]>;
  /** The nights already held from `fromDay` on — no names, for the public calendar. */
  listBusyFrom(fromDay: string): Promise<SuiteBusyRange[]>;
  /** Requests still waiting for an answer whose check-in is before `day`, oldest first. */
  listRequestsArrivingBefore(day: string): Promise<SuiteBooking[]>;
  /**
   * Cancel a stay request nobody answered as expired at `at` (`expiredAt`) — only
   * while it's still `requested` and arrives before `day`, so one answered or moved
   * meanwhile is left alone (`null`). The audit entry commits with it.
   */
  expireRequest(id: string, day: string, at: Date, audit?: AuditHook<SuiteBooking>): Promise<SuiteBooking | null>;
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
  /**
   * Save a stay's edited days and party, guarded on `expectedStatus` like
   * `applyStatus`. Nights that move are checked against every stay holding the
   * suite under the suite's lock (`ConflictError("SUITE_TAKEN")`) — as a request's
   * are when it's made — and the database's overlap trigger checks them again.
   */
  applyStayEdit(
    id: string,
    expectedStatus: SuiteBookingStatus,
    edit: SuiteStayEdit,
    audit?: AuditHook<SuiteBooking>,
  ): Promise<SuiteBooking>;
};
