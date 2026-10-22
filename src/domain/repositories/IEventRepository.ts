import type { AuditHook } from "./AuditHook";
import type { CafeEvent, EventRegistration, EventTableOption } from "../entities/CafeEvent";

/**
 * An event as the admin form writes it. Derived and stored-only fields are the
 * repository's; held tables are set on their own (`holdTables`).
 */
export type NewCafeEvent = Omit<CafeEvent, "id" | "seatsTaken" | "tableLabels" | "createdAt" | "updatedAt">;

/** A sign-up about to be made. */
export type NewRegistration = Omit<EventRegistration, "id" | "eventId" | "status" | "createdAt">;

export type IEventRepository = {
  /** Published events that haven't started yet, soonest first — the public listing. */
  listUpcomingPublished(now: Date): Promise<CafeEvent[]>;
  /** Every event in any state, newest start first — the dashboard listing. */
  listAll(): Promise<CafeEvent[]>;
  getById(id: string): Promise<CafeEvent | null>;
  create(input: NewCafeEvent, audit?: AuditHook<CafeEvent>): Promise<CafeEvent>;
  /**
   * Save the form's fields. A held table that clashes at the new time (a guest
   * booking or another event has it then) is released in the same transaction,
   * so the result's `tableLabels` may be shorter than before.
   */
  update(id: string, input: NewCafeEvent, audit?: AuditHook<CafeEvent>): Promise<CafeEvent>;

  /** Every floor table for the event, with whether it's held and what else has it then; `null` when no such event. */
  listTableOptions(eventId: string): Promise<EventTableOption[] | null>;
  /**
   * Replace the tables held for the event, atomically: with each table locked,
   * refuse (`ConflictError("TABLE_TAKEN")`) when a guest booking or another event
   * has any of them during the event — the same lock the reservation side takes,
   * so a table can't be booked and held at once.
   */
  holdTables(eventId: string, tableLabels: string[], audit?: AuditHook<CafeEvent>): Promise<CafeEvent>;
  /** Refuses (`ResourceInUseError`) while the event has active registrations — unpublish it instead. */
  delete(id: string, audit?: AuditHook<void>): Promise<void>;

  /**
   * Sign a guest up, atomically: with the event row locked, refuse when it's
   * unpublished or already started (`EVENT_CLOSED`), when the guest already holds
   * an active registration (`ALREADY_REGISTERED`), or when the seats would exceed
   * capacity (`EVENT_FULL`) — so two guests can't both take the last seat.
   */
  register(eventId: string, input: NewRegistration, now: Date): Promise<EventRegistration>;
  getRegistration(id: string): Promise<EventRegistration | null>;
  /** Mark a registration cancelled, freeing its seats. Idempotent for an already-cancelled one. */
  cancelRegistration(id: string, audit?: AuditHook<EventRegistration>): Promise<EventRegistration>;
  /** An event's registrations, oldest first. */
  listRegistrations(eventId: string): Promise<EventRegistration[]>;
  /** One guest's registrations, newest first. */
  listRegistrationsForUser(userId: string): Promise<EventRegistration[]>;
};
