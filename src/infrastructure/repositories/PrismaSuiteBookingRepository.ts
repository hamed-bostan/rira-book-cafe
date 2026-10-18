import {
  SUITE_BOOKING_STATUSES,
  SUITE_HOLDING_STATUSES,
  type SuiteBooking,
  type SuiteBookingStatus,
  type SuiteBusyRange,
} from "@/src/domain/entities/SuiteBooking";
import { ConflictError } from "@/src/domain/errors/ConflictError";
import { NotFoundError } from "@/src/domain/errors/NotFoundError";
import type { AuditHook } from "@/src/domain/repositories/AuditHook";
import type { ISuiteBookingRepository, NewSuiteBooking } from "@/src/domain/repositories/ISuiteBookingRepository";
import { prisma } from "@/src/infrastructure/prisma/client";
import { inTransaction, type PrismaDb } from "@/src/infrastructure/prisma/transaction";

import { recordAudit } from "./writeActivityEntry";

import type { Prisma } from "@prisma/client";

/**
 * Suite stays backed by PostgreSQL via Prisma. Days are stored as `DATE` columns,
 * which Prisma hands over as midnight UTC — `toDay`/`fromDay` convert to and from
 * the domain's `YYYY-MM-DD`. Server-side only, bound through the container.
 */
export class PrismaSuiteBookingRepository implements ISuiteBookingRepository {
  constructor(private readonly db: PrismaDb = prisma) {}

  async create(input: NewSuiteBooking): Promise<SuiteBooking> {
    return inTransaction(this.db, async (tx) => {
      await lockSuite(tx);
      await refuseClash(tx, null, input);
      const row = await tx.suiteBooking.create({
        data: {
          userId: input.userId,
          guestName: input.guestName,
          guestPhone: input.guestPhone,
          guests: input.guests,
          checkIn: fromDay(input.checkIn),
          checkOut: fromDay(input.checkOut),
          note: input.note ?? null,
        },
      });
      return toSuiteBooking(row);
    });
  }

  async getById(id: string): Promise<SuiteBooking | null> {
    const row = await this.db.suiteBooking.findUnique({ where: { id } });
    return row ? toSuiteBooking(row) : null;
  }

  async listForUser(userId: string): Promise<SuiteBooking[]> {
    const rows = await this.db.suiteBooking.findMany({ where: { userId }, orderBy: { checkIn: "asc" } });
    return rows.map(toSuiteBooking);
  }

  async listFrom(day: string, status?: SuiteBookingStatus): Promise<SuiteBooking[]> {
    const rows = await this.db.suiteBooking.findMany({
      where: { checkOut: { gt: fromDay(day) }, ...(status ? { status } : {}) },
      orderBy: [{ checkIn: "asc" }, { reference: "asc" }],
    });
    return rows.map(toSuiteBooking);
  }

  async listBusyFrom(day: string): Promise<SuiteBusyRange[]> {
    const rows = await this.db.suiteBooking.findMany({
      where: { checkOut: { gt: fromDay(day) }, status: { in: [...SUITE_HOLDING_STATUSES] } },
      select: { checkIn: true, checkOut: true },
      orderBy: { checkIn: "asc" },
    });
    return rows.map((row) => ({ checkIn: toDay(row.checkIn), checkOut: toDay(row.checkOut) }));
  }

  async applyStatus(
    id: string,
    expectedStatus: SuiteBookingStatus,
    status: SuiteBookingStatus,
    audit?: AuditHook<SuiteBooking>,
  ): Promise<SuiteBooking> {
    return inTransaction(this.db, async (tx) => {
      const current = await tx.suiteBooking.findUnique({ where: { id } });
      if (!current) throw new NotFoundError("suite booking", id);

      if ((SUITE_HOLDING_STATUSES as readonly string[]).includes(status)) {
        await lockSuite(tx);
        await refuseClash(tx, id, { checkIn: toDay(current.checkIn), checkOut: toDay(current.checkOut) });
      }

      // Guarded on the status the caller read: a concurrent change makes this match nothing.
      const result = await tx.suiteBooking.updateMany({ where: { id, status: expectedStatus }, data: { status } });
      if (result.count === 0) {
        throw new ConflictError("INVALID_TRANSITION", "This booking was just changed by someone else.");
      }

      const saved = toSuiteBooking(await tx.suiteBooking.findUniqueOrThrow({ where: { id } }));
      await recordAudit(tx, saved, audit);
      return saved;
    });
  }
}

/**
 * Serialize every write that could hold the suite. Two staff confirming
 * overlapping stays at once take turns here, so the clash check can't race. The
 * database trigger takes the same lock and repeats the check as a backstop.
 */
async function lockSuite(tx: Prisma.TransactionClient): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('suite'))`;
}

async function refuseClash(tx: Prisma.TransactionClient, id: string | null, range: SuiteBusyRange): Promise<void> {
  const clash = await tx.suiteBooking.findFirst({
    where: {
      ...(id ? { id: { not: id } } : {}),
      status: { in: [...SUITE_HOLDING_STATUSES] },
      checkIn: { lt: fromDay(range.checkOut) },
      checkOut: { gt: fromDay(range.checkIn) },
    },
    select: { reference: true },
  });
  if (clash)
    throw new ConflictError("SUITE_TAKEN", `The suite is already booked for those nights (S-${clash.reference}).`);
}

/** `YYYY-MM-DD` → the `DATE` value Prisma writes (midnight UTC of that calendar day). */
function fromDay(day: string): Date {
  return new Date(`${day}T00:00:00Z`);
}

function toDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

type SuiteBookingRow = Prisma.SuiteBookingGetPayload<object>;

function toStatus(value: string): SuiteBookingStatus {
  return (SUITE_BOOKING_STATUSES as readonly string[]).includes(value) ? (value as SuiteBookingStatus) : "requested";
}

function toSuiteBooking(row: SuiteBookingRow): SuiteBooking {
  return {
    id: row.id,
    reference: row.reference,
    userId: row.userId,
    guestName: row.guestName,
    guestPhone: row.guestPhone,
    guests: row.guests,
    checkIn: toDay(row.checkIn),
    checkOut: toDay(row.checkOut),
    status: toStatus(row.status),
    note: row.note ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
