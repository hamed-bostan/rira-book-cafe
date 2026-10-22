import { TABLE_HOLDING_STATUSES, reservationEndsAt } from "@/src/domain/entities/Reservation";
import type { Prisma } from "@/src/infrastructure/prisma/generated/client";

/**
 * The table clash checks shared by reservations and events. A floor table is
 * taken during a time range by a guest booking that holds it then, or by an
 * event holding it then; whichever side writes first wins, because both take
 * the same per-table lock before checking.
 */

/** Longest a booking can hold a table — bounds how far back an overlapping booking can start. */
const MAX_BOOKING_MS = 6 * 60 * 60 * 1000;

/**
 * Serialize every write that gives these tables away, until the transaction ends.
 * Taken in sorted order so two writers locking overlapping sets can't deadlock.
 */
export async function lockTables(tx: Prisma.TransactionClient, labels: readonly string[]): Promise<void> {
  for (const label of [...new Set(labels)].sort()) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`table:${label}`}))`;
  }
}

/** Table-holding bookings at any of these tables that overlap `[from, to)`. */
export async function bookingsHoldingTables(
  tx: Prisma.TransactionClient,
  labels: readonly string[],
  from: Date,
  to: Date,
  excludeReservationId?: string,
) {
  if (labels.length === 0) return [];
  const candidates = await tx.reservation.findMany({
    where: {
      id: excludeReservationId ? { not: excludeReservationId } : undefined,
      tableLabel: { in: [...labels] },
      status: { in: [...TABLE_HOLDING_STATUSES] },
      startsAt: { gt: new Date(from.getTime() - MAX_BOOKING_MS), lt: to },
    },
    orderBy: { startsAt: "asc" },
  });
  return candidates.filter(
    (row) => reservationEndsAt({ startsAt: row.startsAt.toISOString(), durationMinutes: row.durationMinutes }) > from,
  );
}

/** Events holding any of these tables that overlap `[from, to)`. */
export async function eventsHoldingTables(
  tx: Prisma.TransactionClient,
  labels: readonly string[],
  from: Date,
  to: Date,
  excludeEventId?: string,
) {
  if (labels.length === 0) return [];
  return tx.event.findMany({
    where: {
      id: excludeEventId ? { not: excludeEventId } : undefined,
      tableLabels: { hasSome: [...labels] },
      startsAt: { lt: to },
      endsAt: { gt: from },
    },
    orderBy: { startsAt: "asc" },
  });
}
