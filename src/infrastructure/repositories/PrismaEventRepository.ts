import { Prisma } from "@prisma/client";

import {
  EVENT_KINDS,
  REGISTRATION_STATUSES,
  type CafeEvent,
  type EventKind,
  type EventRegistration,
  type RegistrationStatus,
} from "@/src/domain/entities/CafeEvent";
import { ConflictError } from "@/src/domain/errors/ConflictError";
import { NotFoundError } from "@/src/domain/errors/NotFoundError";
import { ResourceInUseError } from "@/src/domain/errors/ResourceInUseError";
import type { AuditHook } from "@/src/domain/repositories/AuditHook";
import type { IEventRepository, NewCafeEvent, NewRegistration } from "@/src/domain/repositories/IEventRepository";
import { prisma } from "@/src/infrastructure/prisma/client";
import { inTransaction, type PrismaDb } from "@/src/infrastructure/prisma/transaction";

import { recordAudit } from "./writeActivityEntry";

const ACTIVE = "registered";

/**
 * Events and their registrations, backed by PostgreSQL via Prisma. Server-side
 * only, bound through the container — never imported by client code.
 */
export class PrismaEventRepository implements IEventRepository {
  constructor(private readonly db: PrismaDb = prisma) {}

  async listUpcomingPublished(now: Date): Promise<CafeEvent[]> {
    const rows = await this.db.event.findMany({
      where: { isPublished: true, startsAt: { gt: now } },
      orderBy: { startsAt: "asc" },
    });
    return this.withSeats(rows);
  }

  async listAll(): Promise<CafeEvent[]> {
    const rows = await this.db.event.findMany({ orderBy: { startsAt: "desc" } });
    return this.withSeats(rows);
  }

  async getById(id: string): Promise<CafeEvent | null> {
    const row = await this.db.event.findUnique({ where: { id } });
    return row ? (await this.withSeats([row]))[0] : null;
  }

  async create(input: NewCafeEvent, audit?: AuditHook<CafeEvent>): Promise<CafeEvent> {
    return inTransaction(this.db, async (tx) => {
      const event = toEvent(await tx.event.create({ data: toRowData(input) }), 0);
      await recordAudit(tx, event, audit);
      return event;
    });
  }

  async update(id: string, input: NewCafeEvent, audit?: AuditHook<CafeEvent>): Promise<CafeEvent> {
    try {
      return await inTransaction(this.db, async (tx) => {
        const row = await tx.event.update({ where: { id }, data: toRowData(input) });
        const event = toEvent(row, await seatsTaken(tx, id));
        await recordAudit(tx, event, audit);
        return event;
      });
    } catch (error) {
      throw toDomainError(error, id);
    }
  }

  async delete(id: string, audit?: AuditHook<void>): Promise<void> {
    try {
      await inTransaction(this.db, async (tx) => {
        const active = await tx.eventRegistration.count({ where: { eventId: id, status: ACTIVE } });
        if (active > 0) {
          throw new ResourceInUseError(
            "event",
            `${active} guests are still registered. Cancel them or unpublish the event.`,
          );
        }
        await tx.eventRegistration.deleteMany({ where: { eventId: id } });
        await tx.event.delete({ where: { id } });
        await recordAudit(tx, undefined, audit);
      });
    } catch (error) {
      throw toDomainError(error, id);
    }
  }

  async register(eventId: string, input: NewRegistration, now: Date): Promise<EventRegistration> {
    return inTransaction(this.db, async (tx) => {
      // Lock the event row: concurrent sign-ups for the same event take turns, so
      // the seat count below can't be read stale by two guests at once.
      const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM events WHERE id = ${eventId} FOR UPDATE`;
      if (locked.length === 0) throw new NotFoundError("event", eventId);

      const event = await tx.event.findUniqueOrThrow({ where: { id: eventId } });
      if (!event.isPublished || event.startsAt <= now) {
        throw new ConflictError("EVENT_CLOSED", "Sign-ups for this event are closed.");
      }

      const existing = await tx.eventRegistration.count({ where: { eventId, userId: input.userId, status: ACTIVE } });
      if (existing > 0) throw new ConflictError("ALREADY_REGISTERED", "You're already signed up for this event.");

      if (event.capacity !== null) {
        const taken = await seatsTaken(tx, eventId);
        if (taken + input.seats > event.capacity) {
          throw new ConflictError("EVENT_FULL", `Only ${Math.max(event.capacity - taken, 0)} seats are left.`);
        }
      }

      const row = await tx.eventRegistration.create({
        data: {
          eventId,
          userId: input.userId,
          guestName: input.guestName,
          guestPhone: input.guestPhone,
          seats: input.seats,
        },
      });
      return toRegistration(row);
    });
  }

  async getRegistration(id: string): Promise<EventRegistration | null> {
    const row = await this.db.eventRegistration.findUnique({ where: { id } });
    return row ? toRegistration(row) : null;
  }

  async cancelRegistration(id: string, audit?: AuditHook<EventRegistration>): Promise<EventRegistration> {
    return inTransaction(this.db, async (tx) => {
      const current = await tx.eventRegistration.findUnique({ where: { id } });
      if (!current) throw new NotFoundError("registration", id);
      if (current.status !== ACTIVE) return toRegistration(current);

      const saved = toRegistration(await tx.eventRegistration.update({ where: { id }, data: { status: "cancelled" } }));
      await recordAudit(tx, saved, audit);
      return saved;
    });
  }

  async listRegistrations(eventId: string): Promise<EventRegistration[]> {
    const rows = await this.db.eventRegistration.findMany({ where: { eventId }, orderBy: { createdAt: "asc" } });
    return rows.map(toRegistration);
  }

  async listRegistrationsForUser(userId: string): Promise<EventRegistration[]> {
    const rows = await this.db.eventRegistration.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
    return rows.map(toRegistration);
  }

  /** Attach each event's taken seats with one grouped query. */
  private async withSeats(rows: EventRow[]): Promise<CafeEvent[]> {
    if (rows.length === 0) return [];
    const groups = await this.db.eventRegistration.groupBy({
      by: ["eventId"],
      where: { eventId: { in: rows.map((row) => row.id) }, status: ACTIVE },
      _sum: { seats: true },
    });
    const taken = new Map(groups.map((group) => [group.eventId, group._sum.seats ?? 0]));
    return rows.map((row) => toEvent(row, taken.get(row.id) ?? 0));
  }
}

type EventRow = Prisma.EventGetPayload<object>;
type RegistrationRow = Prisma.EventRegistrationGetPayload<object>;

async function seatsTaken(tx: Prisma.TransactionClient, eventId: string): Promise<number> {
  const result = await tx.eventRegistration.aggregate({ where: { eventId, status: ACTIVE }, _sum: { seats: true } });
  return result._sum.seats ?? 0;
}

function toRowData(input: NewCafeEvent) {
  return {
    kind: input.kind,
    title: input.title,
    description: input.description ?? null,
    titleFa: input.titleFa ?? null,
    descriptionFa: input.descriptionFa ?? null,
    imageUrl: input.imageUrl ?? null,
    startsAt: new Date(input.startsAt),
    endsAt: new Date(input.endsAt),
    capacity: input.capacity ?? null,
    price: input.price,
    isPublished: input.isPublished,
  };
}

function toKind(value: string): EventKind {
  return (EVENT_KINDS as readonly string[]).includes(value) ? (value as EventKind) : "other";
}

function toRegistrationStatus(value: string): RegistrationStatus {
  return (REGISTRATION_STATUSES as readonly string[]).includes(value) ? (value as RegistrationStatus) : "cancelled";
}

function toEvent(row: EventRow, taken: number): CafeEvent {
  return {
    id: row.id,
    kind: toKind(row.kind),
    title: row.title,
    description: row.description ?? undefined,
    titleFa: row.titleFa ?? undefined,
    descriptionFa: row.descriptionFa ?? undefined,
    imageUrl: row.imageUrl ?? undefined,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    capacity: row.capacity ?? undefined,
    price: row.price,
    isPublished: row.isPublished,
    seatsTaken: taken,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toRegistration(row: RegistrationRow): EventRegistration {
  return {
    id: row.id,
    eventId: row.eventId,
    userId: row.userId,
    guestName: row.guestName,
    guestPhone: row.guestPhone,
    seats: row.seats,
    status: toRegistrationStatus(row.status),
    createdAt: row.createdAt.toISOString(),
  };
}

function toDomainError(error: unknown, id: string): unknown {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
    return new NotFoundError("event", id, { cause: error });
  }
  return error;
}
