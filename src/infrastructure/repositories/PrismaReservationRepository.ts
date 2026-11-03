import type { ActivityActor } from "@/src/domain/entities/ActivityEntry";
import {
  RESERVATION_STATUSES,
  TABLE_HOLDING_STATUSES,
  reservationEndsAt,
  type Reservation,
  type ReservationStatus,
} from "@/src/domain/entities/Reservation";
import { RESERVATION_DEPOSIT_METHODS, RESERVATION_DEPOSIT_STATES } from "@/src/domain/entities/ReservationDeposit";
import { ConflictError } from "@/src/domain/errors/ConflictError";
import { NotFoundError } from "@/src/domain/errors/NotFoundError";
import type { AuditHook } from "@/src/domain/repositories/AuditHook";
import type {
  IReservationRepository,
  NewReservation,
  ReservationChange,
  ReservationEdit,
} from "@/src/domain/repositories/IReservationRepository";
import { prisma } from "@/src/infrastructure/prisma/client";
import type { Prisma } from "@/src/infrastructure/prisma/generated/client";
import { inTransaction, type PrismaDb } from "@/src/infrastructure/prisma/transaction";

import { bookingsHoldingTables, eventsHoldingTables, lockTables } from "./tableHolds";
import { recordAudit } from "./writeActivityEntry";
import { createGuestProfile } from "./writeGuestProfile";

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
      await createGuestProfile(tx, input.newGuest);
      const row = await tx.reservation.create({
        data: {
          userId: input.userId,
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

  async listFrom(from: Date, status?: ReservationStatus): Promise<Reservation[]> {
    const rows = await this.db.reservation.findMany({
      where: { startsAt: { gte: from }, ...(status ? { status } : {}) },
      orderBy: [{ startsAt: "asc" }, { reference: "asc" }],
    });
    return rows.map(toReservation);
  }

  async expireRequest(id: string, at: Date, audit?: AuditHook<Reservation>): Promise<Reservation | null> {
    return inTransaction(this.db, async (tx) => {
      // Guarded: a request staff answered, or moved later, a moment ago matches nothing.
      const result = await tx.reservation.updateMany({
        where: { id, status: "requested", startsAt: { lte: at } },
        data: { status: "cancelled", expiredAt: at },
      });
      if (result.count === 0) return null;
      const saved = toReservation(await tx.reservation.findUniqueOrThrow({ where: { id } }));
      await recordAudit(tx, saved, audit);
      return saved;
    });
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

  async applyEdit(
    id: string,
    expectedStatus: ReservationStatus,
    edit: ReservationEdit,
    audit?: AuditHook<Reservation>,
  ): Promise<Reservation> {
    return inTransaction(this.db, async (tx) => {
      // A new time or length is checked against everything else holding the table then.
      if ((TABLE_HOLDING_STATUSES as readonly string[]).includes(expectedStatus) && edit.tableLabel) {
        const startsAt = new Date(edit.startsAt);
        await refuseTakenTable(tx, edit.tableLabel, startsAt, reservationEndsAt(edit), id);
      }

      // Guarded on the status the caller read: a concurrent change makes this match nothing.
      const result = await tx.reservation.updateMany({
        where: { id, status: expectedStatus },
        data: {
          startsAt: new Date(edit.startsAt),
          durationMinutes: edit.durationMinutes,
          partySize: edit.partySize,
          note: edit.note,
          tableLabel: edit.tableLabel,
        },
      });
      if (result.count === 0) {
        if (!(await tx.reservation.findUnique({ where: { id }, select: { id: true } }))) {
          throw new NotFoundError("reservation", id);
        }
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

/** The booking's deposit, when one was taken; nothing to spread otherwise. */
function toDeposit(row: ReservationRow): Pick<Reservation, "deposit"> {
  const method = RESERVATION_DEPOSIT_METHODS.find((value) => value === row.depositMethod);
  const state = RESERVATION_DEPOSIT_STATES.find((value) => value === row.depositState);
  if (row.depositAmount <= BigInt(0) || !method || !state) return {};
  return { deposit: { amount: Number(row.depositAmount), method, state } };
}

function toStatus(value: string): ReservationStatus {
  return (RESERVATION_STATUSES as readonly string[]).includes(value) ? (value as ReservationStatus) : "requested";
}

export function toReservation(row: ReservationRow): Reservation {
  return {
    ...toDeposit(row),
    id: row.id,
    reference: row.reference,
    userId: row.userId ?? undefined,
    guestName: row.guestName,
    guestPhone: row.guestPhone,
    partySize: row.partySize,
    startsAt: row.startsAt.toISOString(),
    durationMinutes: row.durationMinutes,
    status: toStatus(row.status),
    expiredAt: row.expiredAt?.toISOString(),
    tableLabel: row.tableLabel ?? undefined,
    note: row.note ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
