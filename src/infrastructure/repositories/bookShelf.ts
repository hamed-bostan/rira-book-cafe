import {
  OPEN_WAITLIST_STATUSES,
  WAITLIST_STATUSES,
  type BookWaitlistEntry,
  type WaitlistStatus,
} from "@/src/domain/entities/BookWaitlist";
import type { Prisma } from "@/src/infrastructure/prisma/generated/client";

/** The statuses that hold a place in a book's line, as a Prisma filter. */
export const OPEN_HOLD = { in: [...OPEN_WAITLIST_STATUSES] };

/**
 * Serialize everything that moves a book's copies for the rest of the transaction:
 * lending one, closing a loan, telling the next guest in line, taking a guest off
 * it. One key per book, shared by the loans and the line, so a loan can't take the
 * copy a guest is being told about. The `book_loans_no_duplicate` trigger takes
 * the same key — advisory locks are re-entrant within a transaction, so that's no
 * wait — which is why it must stay `book-loan:<id>`. Every caller locks one book
 * and takes nothing after it; the only lock taken first is {@link lockGuestHolds},
 * so two callers can't wait on each other.
 */
export async function lockBookShelf(tx: Prisma.TransactionClient, productId: string): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`book-loan:${productId}`}))`;
}

/**
 * Serialize one guest taking holds, for the rest of the transaction, so the cap on
 * how many they hold across books (`canHoldAnother`) can't be raced past by two
 * books at once. Taken before {@link lockBookShelf}, never after it — nothing
 * holding a book's lock waits for a guest's.
 */
export async function lockGuestHolds(tx: Prisma.TransactionClient, userId: string): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`book-holds:${userId}`}))`;
}

type EntryRow = Prisma.BookWaitlistEntryGetPayload<object>;

function toStatus(value: string): WaitlistStatus {
  return (WAITLIST_STATUSES as readonly string[]).includes(value) ? (value as WaitlistStatus) : "waiting";
}

/** A waitlist row as the domain reads it — shared by the line's repository and lending, which closes holds. */
export function toWaitlistEntry(row: EntryRow): BookWaitlistEntry {
  return {
    id: row.id,
    productId: row.productId,
    bookTitle: row.bookTitle,
    userId: row.userId ?? undefined,
    guestName: row.guestName,
    guestPhone: row.guestPhone,
    status: toStatus(row.status),
    notifiedAt: row.notifiedAt?.toISOString(),
    pickupBy: row.pickupBy?.toISOString(),
    expiredAt: row.expiredAt?.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
