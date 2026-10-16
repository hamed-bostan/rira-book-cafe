import type { ActivityActor } from "@/src/domain/entities/ActivityEntry";
import {
  RESERVATION_STATUSES,
  TABLE_HOLDING_STATUSES,
  reservationEndsAt,
  type Reservation,
  type ReservationStatus,
} from "@/src/domain/entities/Reservation";
import { ConflictError } from "@/src/domain/errors/ConflictError";
import { NotFoundError } from "@/src/domain/errors/NotFoundError";
import type { AuditHook } from "@/src/domain/repositories/AuditHook";
import type {
  IReservationRepository,
  NewReservation,
  ReservationChange,
} from "@/src/domain/repositories/IReservationRepository";
import { prisma } from "@/src/infrastructure/prisma/client";
import { inTransaction, type PrismaDb } from "@/src/infrastructure/prisma/transaction";

import { recordAudit } from "./writeActivityEntry";

import type { Prisma } from "@prisma/client";

/** The longest booking, bounding how far back the clash check needs to look. */
const MAX_DURATION_MS = 6 * 60 * 60 * 1000;

/**
 * Reservations backed by PostgreSQL via Prisma. Server-side only, bound through
 * the container — never imported by client code.
 */
export class PrismaReservationRepository implements IReservationRepository {
  constructor(private readonly db: PrismaDb = prisma) {}

  async create(input: NewReservation): Promise<Reservation> {
    const row = await this.db.reservation.create({
      data: {
        userId: input.userId,
        guestName: input.guestName,
        guestPhone: input.guestPhone,
        partySize: input.partySize,
        startsAt: new Date(input.startsAt),
        durationMinutes: input.durationMinutes,
        note: input.note ?? null,
      },
    });
    return toReservation(row);
  }

  async getById(id: string): Promise<Reservation | null> {
    const row = await this.db.reservation.findUnique({ where: { id } });
    return row ? toReservation(row) : null;
  }

  async listForUser(userId: string): Promise<Reservation[]> {
    const rows = await this.db.reservation.findMany({ where: { userId }, orderBy: { startsAt: "asc" } });
    return rows.map(toReservation);
  }

  async listBetween(from: Date, to: Date, status?: ReservationStatus): Promise<Reservation[]> {
    const rows = await this.db.reservation.findMany({
      where: { startsAt: { gte: from, lt: to }, ...(status ? { status } : {}) },
      orderBy: [{ startsAt: "asc" }, { reference: "asc" }],
    });
    return rows.map(toReservation);
  }

  async applyChange(
    id: string,
    expectedStatus: ReservationStatus,
    change: ReservationChange,
    _actor: ActivityActor,
    audit?: AuditHook<Reservation>,
  ): Promise<Reservation> {
    return inTransaction(this.db, async (tx) => {
      const current = await tx.reservation.findUnique({ where: { id } });
      if (!current) throw new NotFoundError("reservation", id);

      const tableLabel = change.tableLabel === undefined ? current.tableLabel : change.tableLabel;
      const holdsTable = (TABLE_HOLDING_STATUSES as readonly string[]).includes(change.status);

      if (holdsTable && tableLabel) {
        // Serialize every booking of this table: two staff assigning the same table
        // at once take turns here, so the clash check below can't race.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`table:${tableLabel}`}))`;

        const startsAt = current.startsAt;
        const endsAt = reservationEndsAt({ startsAt: startsAt.toISOString(), durationMinutes: current.durationMinutes });
        const candidates = await tx.reservation.findMany({
          where: {
            id: { not: id },
            tableLabel,
            status: { in: [...TABLE_HOLDING_STATUSES] },
            startsAt: { gt: new Date(startsAt.getTime() - MAX_DURATION_MS), lt: endsAt },
          },
        });
        const clash = candidates.find((other) => reservationEndsAt(toReservation(other)) > startsAt);
        if (clash) {
          throw new ConflictError("TABLE_TAKEN", `Table ${tableLabel} is already booked (R-${clash.reference}) at that time.`);
        }
      }

      // Guarded on the status the caller read: a concurrent change makes this match nothing.
      const result = await tx.reservation.updateMany({
        where: { id, status: expectedStatus },
        data: { status: change.status, tableLabel },
      });
      if (result.count === 0) {
        throw new ConflictError("INVALID_TRANSITION", "This reservation was just changed by someone else.");
      }

      const saved = toReservation(await tx.reservation.findUniqueOrThrow({ where: { id } }));
      await recordAudit(tx, saved, audit);
      return saved;
    });
  }
}

type ReservationRow = Prisma.ReservationGetPayload<object>;

function toStatus(value: string): ReservationStatus {
  return (RESERVATION_STATUSES as readonly string[]).includes(value) ? (value as ReservationStatus) : "requested";
}

function toReservation(row: ReservationRow): Reservation {
  return {
    id: row.id,
    reference: row.reference,
    userId: row.userId,
    guestName: row.guestName,
    guestPhone: row.guestPhone,
    partySize: row.partySize,
    startsAt: row.startsAt.toISOString(),
    durationMinutes: row.durationMinutes,
    status: toStatus(row.status),
    tableLabel: row.tableLabel ?? undefined,
    note: row.note ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
