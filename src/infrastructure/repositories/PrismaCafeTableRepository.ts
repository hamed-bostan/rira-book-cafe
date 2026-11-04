import type { CafeTable } from "@/src/domain/entities/CafeTable";
import { ACTIVE_ORDER_STATUSES } from "@/src/domain/entities/Order";
import { TABLE_HOLDING_STATUSES, reservationEndsAt } from "@/src/domain/entities/Reservation";
import { NotFoundError } from "@/src/domain/errors/NotFoundError";
import { ResourceInUseError } from "@/src/domain/errors/ResourceInUseError";
import { UniqueConstraintError } from "@/src/domain/errors/UniqueConstraintError";
import type { AuditHook } from "@/src/domain/repositories/AuditHook";
import type { ICafeTableRepository, NewCafeTable } from "@/src/domain/repositories/ICafeTableRepository";
import { prisma } from "@/src/infrastructure/prisma/client";
import { Prisma, type CafeTable as CafeTableRow } from "@/src/infrastructure/prisma/generated/client";
import { inTransaction, type PrismaDb } from "@/src/infrastructure/prisma/transaction";

import { lockTables } from "./tableHolds";
import { recordAudit } from "./writeActivityEntry";

/** Longest a booking can hold a table — bounds how far back a booking still running can start. */
const MAX_BOOKING_MS = 6 * 60 * 60 * 1000;

/** Floor order: by position, and by age where two share one (a create racing another). */
const FLOOR_ORDER: Prisma.CafeTableOrderByWithRelationInput[] = [{ position: "asc" }, { createdAt: "asc" }];

/** The floor's tables, backed by PostgreSQL via Prisma. */
export class PrismaCafeTableRepository implements ICafeTableRepository {
  constructor(private readonly db: PrismaDb = prisma) {}

  async listAll(): Promise<CafeTable[]> {
    const rows = await this.db.cafeTable.findMany({ orderBy: FLOOR_ORDER });
    return rows.map(toCafeTable);
  }

  async getById(id: string): Promise<CafeTable | null> {
    const row = await this.db.cafeTable.findUnique({ where: { id } });
    return row ? toCafeTable(row) : null;
  }

  async create(input: NewCafeTable, audit?: AuditHook<CafeTable>): Promise<CafeTable> {
    try {
      return await inTransaction(this.db, async (tx) => {
        const last = await tx.cafeTable.aggregate({ _max: { position: true } });
        const saved = toCafeTable(
          await tx.cafeTable.create({ data: { ...toRowData(input), position: (last._max.position ?? -1) + 1 } }),
        );
        await recordAudit(tx, saved, audit);
        return saved;
      });
    } catch (error) {
      throw toDomainError(error);
    }
  }

  async update(id: string, input: NewCafeTable, audit?: AuditHook<CafeTable>): Promise<CafeTable> {
    try {
      return await inTransaction(this.db, async (tx) => {
        const current = await tx.cafeTable.findUnique({ where: { id } });
        if (!current) throw new NotFoundError("table", id);
        const renamed = current.label !== input.label;
        // The same per-table lock bookings and event holds take, so none of them
        // writes the old label while it's being carried over to the new one.
        if (renamed) await lockTables(tx, [current.label, input.label]);

        const saved = toCafeTable(await tx.cafeTable.update({ where: { id }, data: toRowData(input) }));
        if (renamed) await carryLabel(tx, current.label, input.label);
        await recordAudit(tx, saved, audit);
        return saved;
      });
    } catch (error) {
      throw toDomainError(error);
    }
  }

  async setOrder(ids: readonly string[], audit?: AuditHook<void>): Promise<void> {
    await inTransaction(this.db, async (tx) => {
      const current = await tx.cafeTable.findMany({ orderBy: FLOOR_ORDER, select: { id: true } });
      const existing = new Set(current.map((row) => row.id));
      const listed = new Set(ids);
      const order = [
        ...ids.filter((id) => existing.has(id)),
        ...current.map((row) => row.id).filter((id) => !listed.has(id)),
      ];
      // Raw SQL so a reorder doesn't stamp every table's `updatedAt`.
      await tx.$executeRaw`
        UPDATE "cafe_tables" AS t
        SET "position" = o.ordinality - 1
        FROM unnest(${order}::text[]) WITH ORDINALITY AS o(id, ordinality)
        WHERE t."id" = o.id AND t."position" <> o.ordinality - 1`;
      await recordAudit(tx, undefined, audit);
    });
  }

  async delete(id: string, now: Date, audit?: AuditHook<CafeTable>): Promise<void> {
    await inTransaction(this.db, async (tx) => {
      const row = await tx.cafeTable.findUnique({ where: { id } });
      if (!row) throw new NotFoundError("table", id);
      const table = toCafeTable(row);
      // Under the table's lock, nothing can be booked onto it or held between the
      // checks below and the delete.
      await lockTables(tx, [table.label]);

      const [openOrders, bookings, events] = await Promise.all([
        tx.order.count({
          where: { tableLabel: table.label, serviceType: "dineIn", status: { in: [...ACTIVE_ORDER_STATUSES] } },
        }),
        tx.reservation.findMany({
          where: {
            tableLabel: table.label,
            status: { in: ["requested", ...TABLE_HOLDING_STATUSES] },
            startsAt: { gt: new Date(now.getTime() - MAX_BOOKING_MS) },
          },
          select: { startsAt: true, durationMinutes: true },
        }),
        tx.event.count({ where: { tableLabels: { has: table.label }, endsAt: { gt: now } } }),
      ]);
      const upcoming = bookings.filter(
        (booking) =>
          reservationEndsAt({ startsAt: booking.startsAt.toISOString(), durationMinutes: booking.durationMinutes }) >
          now,
      ).length;

      const inUse = [
        openOrders > 0 ? `${openOrders} open order${openOrders === 1 ? "" : "s"}` : null,
        upcoming > 0 ? `${upcoming} booking${upcoming === 1 ? "" : "s"} ahead` : null,
        events > 0 ? `${events} event${events === 1 ? "" : "s"} holding it` : null,
      ].filter((reason): reason is string => reason !== null);
      if (inUse.length > 0) {
        throw new ResourceInUseError(
          "table",
          `Table ${table.label} still has ${inUse.join(", ")}. Take it out of use instead.`,
        );
      }

      await tx.cafeTable.delete({ where: { id } });
      await recordAudit(tx, table, audit);
    });
  }
}

/**
 * A renamed table keeps what's on it: every booking and event hold naming the old
 * label, and the open dine-in orders at it, now name the new one. Raw SQL so the
 * carry-over doesn't stamp each booking's `updatedAt` — nobody edited them.
 */
async function carryLabel(tx: Prisma.TransactionClient, from: string, to: string): Promise<void> {
  await tx.$executeRaw`UPDATE "reservations" SET "table_label" = ${to} WHERE "table_label" = ${from}`;
  await tx.$executeRaw`
    UPDATE "events" SET "table_labels" = array_replace("table_labels", ${from}, ${to})
    WHERE ${from} = ANY("table_labels")`;
  await tx.$executeRaw`
    UPDATE "orders" SET "table_label" = ${to}
    WHERE "table_label" = ${from} AND "service_type" = 'dineIn' AND "status" = ANY(${[...ACTIVE_ORDER_STATUSES]}::text[])`;
}

function toRowData(input: NewCafeTable) {
  return { label: input.label, seats: input.seats, area: input.area ?? null, isActive: input.isActive };
}

function toCafeTable(row: CafeTableRow): CafeTable {
  return {
    id: row.id,
    label: row.label,
    seats: row.seats,
    ...(row.area ? { area: row.area } : {}),
    isActive: row.isActive,
    position: row.position,
  };
}

/** A taken label → the field it's about; a row gone mid-write → not found. Everything else passes through. */
function toDomainError(error: unknown): unknown {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") return new UniqueConstraintError(["label"], { cause: error });
    if (error.code === "P2025") return new NotFoundError("table", undefined, { cause: error });
  }
  return error;
}
