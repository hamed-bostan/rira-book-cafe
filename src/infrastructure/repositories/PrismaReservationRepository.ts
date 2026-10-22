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
import type { Prisma } from "@/src/infrastructure/prisma/generated/client";
import { inTransaction, type PrismaDb } from "@/src/infrastructure/prisma/transaction";

import { bookingsHoldingTables, eventsHoldingTables, lockTables } from "./tableHolds";
import { recordAudit } from "./writeActivityEntry";

/**
 * Reservations backed by PostgreSQL via Prisma. Server-side only, bound through
 * the container — never imported by client code.
 */
export class PrismaReservationRepository implements IReservationRepository {
  constructor(private readonly db: PrismaDb = prisma) {}

  async create(input: NewReservation, audit?: AuditHook<Reservation>): Promise<Reservation> {
    return inTransaction(this.db, async (tx) => {
      // A booking made with a table is confirmed on the spot — the table is checked
      // under the same lock as confirming one later.
      if (input.tableLabel) {
        const startsAt = new Date(input.startsAt);
        await refuseTakenTable(tx, input.tableLabel, startsAt, reservationEndsAt(input), null);
      }
      const row = await tx.reservation.create({
        data: {
          userId: input.userId ?? null,
          guestName: input.guestName,
          guestPhone: input.guestPhone,
          partySize: input.partySize,
          startsAt: new Date(input.startsAt),
          durationMinutes: input.durationMinutes,
          note: input.note ?? null,
          ...(input.tableLabel ? { status: "confirmed", tableLabel: input.tableLabel } : {}),
        },
      });
      const saved = toReservation(row);
      await recordAudit(tx, saved, audit);
      return saved;
    });
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
        const endsAt = reservationEndsAt({
          startsAt: current.startsAt.toISOString(),
          durationMinutes: current.durationMinutes,
        });
        await refuseTakenTable(tx, tableLabel, current.startsAt, endsAt, id);
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

/**
 * Refuse a table another booking holds (`TABLE_TAKEN`) or an event holds
 * (`TABLE_HELD`) during `[startsAt, endsAt)`. Takes the table's lock first, so
 * every booking or event hold of it serializes here and the checks can't race.
 */
async function refuseTakenTable(
  tx: Prisma.TransactionClient,
  tableLabel: string,
  startsAt: Date,
  endsAt: Date,
  reservationId: string | null,
): Promise<void> {
  await lockTables(tx, [tableLabel]);
  const [clash] = await bookingsHoldingTables(tx, [tableLabel], startsAt, endsAt, reservationId ?? undefined);
  if (clash) {
    throw new ConflictError(
      "TABLE_TAKEN",
      `Table ${tableLabel} is already booked (R-${clash.reference}) at that time.`,
    );
  }
  const [event] = await eventsHoldingTables(tx, [tableLabel], startsAt, endsAt);
  if (event) {
    throw new ConflictError("TABLE_HELD", `Table ${tableLabel} is held for "${event.title}" at that time.`);
  }
}

function toStatus(value: string): ReservationStatus {
  return (RESERVATION_STATUSES as readonly string[]).includes(value) ? (value as ReservationStatus) : "requested";
}

function toReservation(row: ReservationRow): Reservation {
  return {
    id: row.id,
    reference: row.reference,
    userId: row.userId ?? undefined,
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
