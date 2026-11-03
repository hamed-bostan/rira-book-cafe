import { OPEN_WAITLIST_STATUSES, holdPickupDeadline, type BookWaitlistEntry } from "@/src/domain/entities/BookWaitlist";
import { ConflictError } from "@/src/domain/errors/ConflictError";
import type { AuditHook } from "@/src/domain/repositories/AuditHook";
import type { IBookWaitlistRepository, NewWaitlistEntry } from "@/src/domain/repositories/IBookWaitlistRepository";
import { prisma } from "@/src/infrastructure/prisma/client";
import { Prisma } from "@/src/infrastructure/prisma/generated/client";
import { inTransaction, type PrismaDb } from "@/src/infrastructure/prisma/transaction";

import { OPEN_HOLD as OPEN, lockBookShelf, toWaitlistEntry as toEntry } from "./bookShelf";
import { recordAudit } from "./writeActivityEntry";

/**
 * The book waitlist backed by PostgreSQL via Prisma. A partial unique index keeps
 * a guest in a book's line at most once; telling the next guest is serialized per
 * book with the lock lending takes (`lockBookShelf`).
 */
export class PrismaBookWaitlistRepository implements IBookWaitlistRepository {
  constructor(private readonly db: PrismaDb = prisma) {}

  async join(input: NewWaitlistEntry): Promise<BookWaitlistEntry> {
    try {
      const row = await this.db.bookWaitlistEntry.create({ data: { ...input, userId: input.userId ?? null } });
      return toEntry(row);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictError("ALREADY_WAITING", "This guest is already in line for this book.", { cause: error });
      }
      throw error;
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
