import {
  OPEN_WAITLIST_STATUSES,
  canBorrowBook,
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

import { OPEN_HOLD as OPEN, lockBookShelf, toWaitlistEntry as toEntry } from "./bookShelf";
import { recordAudit } from "./writeActivityEntry";

/** A unique-index refusal as the guest already in line; anything else as it was. */
function alreadyWaiting(error: unknown): unknown {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return new ConflictError("ALREADY_WAITING", "This guest is already in line for this book.", { cause: error });
  }
  return error;
}

/**
 * The book waitlist backed by PostgreSQL via Prisma. A partial unique index keeps
 * a guest in a book's line at most once; telling the next guest, and borrowing a
 * copy from the site, are serialized per book with the lock lending takes
 * (`lockBookShelf`).
 */
export class PrismaBookWaitlistRepository implements IBookWaitlistRepository {
  constructor(private readonly db: PrismaDb = prisma) {}

  async join(input: NewWaitlistEntry): Promise<BookWaitlistEntry> {
    try {
      const row = await this.db.bookWaitlistEntry.create({ data: { ...input, userId: input.userId ?? null } });
      return toEntry(row);
    } catch (error) {
      throw alreadyWaiting(error);
    }
  }

  async borrow(input: NewWaitlistEntry, at: Date): Promise<BookWaitlistEntry> {
    const borrower = { userId: input.userId, phone: input.guestPhone };
    try {
      return await inTransaction(this.db, async (tx) => {
        // Under the book's lock, like a loan: the copy this hold takes is decided
        // against the shelf as it is, so two guests can't borrow the last one.
        await lockBookShelf(tx, input.productId);
        const [book, out, theirs, line] = await Promise.all([
          tx.product.findUnique({ where: { id: input.productId }, select: { bookCopies: true } }),
          tx.bookLoan.count({ where: { productId: input.productId, status: "out" } }),
          tx.bookLoan.findFirst({
            where: {
              productId: input.productId,
              status: "out",
              OR: [{ borrowerPhone: borrower.phone }, ...(borrower.userId ? [{ userId: borrower.userId }] : [])],
            },
            select: { reference: true },
          }),
          tx.bookWaitlistEntry.findMany({ where: { productId: input.productId, status: OPEN } }),
        ]);
        if (theirs) {
          throw new ConflictError("ALREADY_ON_LOAN", `This guest already has this book (L-${theirs.reference}).`);
        }
        const entries = line.map(toEntry);
        if (entries.some((entry) => isHoldFor(entry, borrower))) {
          throw new ConflictError("ALREADY_WAITING", "This guest is already in line for this book.");
        }
        if (!canBorrowBook(lendingCopies({ copies: book?.bookCopies ?? undefined }) - out, entries)) {
          throw new ConflictError("NO_FREE_COPY", "Every copy of this book is out or held. Join its line instead.");
        }
        const row = await tx.bookWaitlistEntry.create({
          data: {
            ...input,
            userId: input.userId ?? null,
            status: "notified",
            notifiedAt: at,
            pickupBy: holdPickupDeadline(at),
          },
        });
        return toEntry(row);
      });
    } catch (error) {
      // A place in line taken a moment ago outside the lock (joining doesn't take it).
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
