import { singleChange, type ActivityActor } from "../../entities/ActivityEntry";
import {
  MAX_SEATS_PER_REGISTRATION,
  type CafeEvent,
  type EventRegistration,
} from "../../entities/CafeEvent";
import { NotFoundError } from "../../errors/NotFoundError";
import { ValidationError } from "../../errors/ValidationError";

import type { User } from "../../entities/User";
import type { IEventRepository } from "../../repositories/IEventRepository";

/**
 * A signed-in guest signs up for an event. The capacity, "already started" and
 * "already registered" rules are enforced by the repository under a row lock, so
 * they hold even when two guests click at once.
 */
export class RegisterForEvent {
  constructor(private readonly eventRepo: IEventRepository) {}

  async execute(eventId: string, seats: number, guest: Pick<User, "id" | "name" | "phone">, now: Date): Promise<EventRegistration> {
    if (!Number.isInteger(seats) || seats < 1 || seats > MAX_SEATS_PER_REGISTRATION) {
      throw new ValidationError("seats", `Choose 1–${MAX_SEATS_PER_REGISTRATION} seats.`);
    }
    return this.eventRepo.register(
      eventId,
      { userId: guest.id, guestName: guest.name, guestPhone: guest.phone, seats },
      now,
    );
  }
}

/** A guest cancels their own sign-up. Someone else's reads as not found. */
export class CancelOwnRegistration {
  constructor(private readonly eventRepo: IEventRepository) {}

  async execute(registrationId: string, userId: string): Promise<EventRegistration> {
    const registration = await this.eventRepo.getRegistration(registrationId);
    if (registration?.userId !== userId) throw new NotFoundError("registration", registrationId);
    return this.eventRepo.cancelRegistration(registrationId);
  }
}

/** Staff cancel a sign-up (a no-show, a duplicate, a guest who called). Audited. */
export class CancelRegistrationAsStaff {
  constructor(private readonly eventRepo: IEventRepository) {}

  async execute(eventId: string, registrationId: string, actor: ActivityActor): Promise<EventRegistration> {
    const [event, registration] = await Promise.all([
      this.eventRepo.getById(eventId),
      this.eventRepo.getRegistration(registrationId),
    ]);
    if (!event || registration?.eventId !== eventId) throw new NotFoundError("registration", registrationId);
    if (registration.status === "cancelled") return registration;

    return this.eventRepo.cancelRegistration(registrationId, (saved) => ({
      actorId: actor.id,
      actorName: actor.name,
      action: "event.registrationCancelled",
      entityType: "event",
      entityId: event.id,
      entityLabel: event.title,
      changes: singleChange("registration", `${saved.guestName} (${saved.seats})`, null),
    }));
  }
}

/** Event reads. */
export class EventQueries {
  constructor(private readonly eventRepo: IEventRepository) {}

  listUpcomingPublished(now: Date): Promise<CafeEvent[]> {
    return this.eventRepo.listUpcomingPublished(now);
  }

  listAll(): Promise<CafeEvent[]> {
    return this.eventRepo.listAll();
  }

  getById(id: string): Promise<CafeEvent | null> {
    return this.eventRepo.getById(id);
  }

  /** A published event only — what a guest may see. */
  async getPublished(id: string): Promise<CafeEvent | null> {
    const event = await this.eventRepo.getById(id);
    return event?.isPublished ? event : null;
  }

  listRegistrations(eventId: string): Promise<EventRegistration[]> {
    return this.eventRepo.listRegistrations(eventId);
  }

  listRegistrationsForUser(userId: string): Promise<EventRegistration[]> {
    return this.eventRepo.listRegistrationsForUser(userId);
  }
}
