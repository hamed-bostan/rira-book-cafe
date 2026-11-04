import {
  OPEN_WAITLIST_STATUSES,
  bookHasLine,
  canBorrowBook,
  canHoldAnother,
  holdPickupDeadline,
  isHoldFor,
  type BookWaitlistEntry,
} from "@/src/domain/entities/BookWaitlist";
import { lendingCopies } from "@/src/domain/entities/Product";
import { ConflictError } from "@/src/domain/errors/ConflictError";
import type { AuditHook } from "@/src/domain/repositories/AuditHook";
import type { IBookWaitlistRepository, NewWaitlistEntry } from "@/src/domain/repositories/IBookWaitlistRepository";
import { prisma } from "@/src/infrastructure/prisma/client";
import { Prisma } from "@/src/infrastructure/prisma/generated/client";
import { inTransaction, type PrismaDb } from "@/src/infrastructure/prisma/transaction";

import { OPEN_HOLD as OPEN, lockBookShelf, lockGuestHolds, toWaitlistEntry as toEntry } from "./bookShelf";
import { recordAudit } from "./writeActivityEntry";
import { createGuestProfile } from "./writeGuestProfile";

/** A unique-index refusal as the guest already in line; anything else as it was. */
function alreadyWaiting(error: unknown): unknown {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return new ConflictError("ALREADY_WAITING", "This guest is already in line for this book.", { cause: error });
  }
  return error;
}

/**
 * The book waitlist backed by PostgreSQL via Prisma. A partial unique index keeps
 * a guest in a book's line at most once; taking a hold, and telling the next guest,
 * are serialized per book with the lock lending takes (`lockBookShelf`).
 */
export class PrismaBookWaitlistRepository implements IBookWaitlistRepository {
  constructor(private readonly db: PrismaDb = prisma) {}

  join(input: NewWaitlistEntry): Promise<BookWaitlistEntry> {
    return this.takeHold(input, null);
  }

  borrow(input: NewWaitlistEntry, at: Date): Promise<BookWaitlistEntry> {
    return this.takeHold(input, at);
  }

  async countOpenForUser(userId: string): Promise<number> {
    return this.db.bookWaitlistEntry.count({ where: { userId, status: OPEN } });
  }

  /**
   * A guest's new hold: in the book's line (`borrowedAt` null), or on a free copy
   * borrowed at `borrowedAt`, ready to collect. Under the guest's lock, so their
   * holds across books can't race past the cap, then the book's, like a loan: the
   * hold is decided against the shelf as it is, so two guests can't take the last
   * copy. A new guest's profile is made in the same transaction.
   */
  private async takeHold(input: NewWaitlistEntry, borrowedAt: Date | null): Promise<BookWaitlistEntry> {
    const { newGuest, ...entry } = input;
    const guest = { userId: entry.userId, phone: entry.guestPhone };
    const theirs = [{ userId: guest.userId }, { guestPhone: guest.phone }];
    try {
      return await inTransaction(this.db, async (tx) => {
        await lockGuestHolds(tx, guest.userId);
        await lockBookShelf(tx, entry.productId);
        const [book, out, onLoan, line, held] = await Promise.all([
          tx.product.findUnique({ where: { id: entry.productId }, select: { bookCopies: true } }),
          tx.bookLoan.count({ where: { productId: entry.productId, status: "out" } }),
          tx.bookLoan.findFirst({
            where: {
              productId: entry.productId,
              status: "out",
              OR: [{ borrowerPhone: guest.phone }, { userId: guest.userId }],
            },
            select: { reference: true },
          }),
          tx.bookWaitlistEntry.findMany({ where: { productId: entry.productId, status: OPEN } }),
          tx.bookWaitlistEntry.count({ where: { status: OPEN, OR: theirs } }),
        ]);
        if (onLoan) {
          throw new ConflictError("ALREADY_ON_LOAN", `This guest already has this book (L-${onLoan.reference}).`);
        }
        const entries = line.map(toEntry);
        if (entries.some((open) => isHoldFor(open, guest))) {
          throw new ConflictError("ALREADY_WAITING", "This guest is already in line for this book.");
        }
        if (!canHoldAnother(held)) {
          throw new ConflictError("HOLD_LIMIT", "This guest already holds as many books as one may.");
        }
        const free = lendingCopies({ copies: book?.bookCopies ?? undefined }) - out;
        if (borrowedAt && !canBorrowBook(free, entries)) {
          throw new ConflictError("NO_FREE_COPY", "Every copy of this book is out or held. Join its line instead.");
        }
        if (!borrowedAt && !bookHasLine(free, entries)) {
          throw new ConflictError("BOOK_ON_SHELF", "This book is on the shelf — lend it instead.");
        }

        await createGuestProfile(tx, newGuest);
        const row = await tx.bookWaitlistEntry.create({
          data: borrowedAt
            ? { ...entry, status: "notified", notifiedAt: borrowedAt, pickupBy: holdPickupDeadline(borrowedAt) }
            : entry,
        });
        return toEntry(row);
      });
    } catch (error) {
      // The unique indexes back up the check above.
      throw alreadyWaiting(error);
    }
  }

  async getById(id: string): Promise<BookWaitlistEntry | null> {
    const row = await this.db.bookWaitlistEntry.findUnique({ where: { id } });
    return row ? toEntry(row) : null;
  }

  async listForUser(userId: string): Promise<BookWaitlistEntry[]> {
    const rows = await this.db.bookWaitlistEntry.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return rows.map(toEntry);
  }

  async listOpenForBook(productId: string): Promise<BookWaitlistEntry[]> {
    const rows = await this.db.bookWaitlistEntry.findMany({
      where: { productId, status: OPEN },
      orderBy: { createdAt: "asc" },
    });
    return rows.map(toEntry);
  }

  async listOpen(): Promise<BookWaitlistEntry[]> {
    // Uncapped: a cap would drop guests from the end of a line without a word, and
    // the open lines stay small — one place per guest per book that's out.
    const rows = await this.db.bookWaitlistEntry.findMany({
      where: { status: OPEN },
      orderBy: [{ bookTitle: "asc" }, { productId: "asc" }, { createdAt: "asc" }],
    });
    return rows.map(toEntry);
  }

  async listClosedSince(since: Date): Promise<BookWaitlistEntry[]> {
    const rows = await this.db.bookWaitlistEntry.findMany({
      where: { status: { notIn: [...OPEN_WAITLIST_STATUSES] }, updatedAt: { gte: since } },
      orderBy: [{ updatedAt: "desc" }],
      take: 200,
    });
    return rows.map(toEntry);
  }

  async cancel(id: string): Promise<BookWaitlistEntry | null> {
    return inTransaction(this.db, async (tx) => {
      const entry = await tx.bookWaitlistEntry.findUnique({ where: { id }, select: { productId: true } });
      if (!entry) return null;
      // Under the book's lock, so a loan deciding whose held copy it takes sees the line as it is.
      await lockBookShelf(tx, entry.productId);
      const result = await tx.bookWaitlistEntry.updateMany({
        where: { id, status: OPEN },
        data: { status: "cancelled" },
      });
      if (result.count === 0) return null;
      return toEntry(await tx.bookWaitlistEntry.findUniqueOrThrow({ where: { id } }));
    });
  }

  async expireHold(id: string, at: Date, audit?: AuditHook<BookWaitlistEntry>): Promise<BookWaitlistEntry | null> {
    return inTransaction(this.db, async (tx) => {
      const entry = await tx.bookWaitlistEntry.findUnique({ where: { id }, select: { productId: true } });
      if (!entry) return null;
      // Under the book's lock, like every move of its copies: a loan to them a moment
      // ago has fulfilled the hold, and then this matches nothing.
      await lockBookShelf(tx, entry.productId);
      const result = await tx.bookWaitlistEntry.updateMany({
        where: { id, status: "notified", pickupBy: { lt: at } },
        data: { status: "cancelled", expiredAt: at },
      });
      if (result.count === 0) return null;
      const saved = toEntry(await tx.bookWaitlistEntry.findUniqueOrThrow({ where: { id } }));
      await recordAudit(tx, saved, audit);
      return saved;
    });
  }

  async notifyNext(productId: string, at: Date): Promise<BookWaitlistEntry | null> {
    return inTransaction(this.db, async (tx) => {
      await lockBookShelf(tx, productId);
      const next = await tx.bookWaitlistEntry.findFirst({
        where: { productId, status: "waiting" },
        orderBy: { createdAt: "asc" },
      });
      if (!next) return null;
      const row = await tx.bookWaitlistEntry.update({
        where: { id: next.id },
        data: { status: "notified", notifiedAt: at, pickupBy: holdPickupDeadline(at) },
      });
      return toEntry(row);
    });
  }
}
