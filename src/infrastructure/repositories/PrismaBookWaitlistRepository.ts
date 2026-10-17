import { Prisma } from "@prisma/client";

import { OPEN_WAITLIST_STATUSES, WAITLIST_STATUSES, type BookWaitlistEntry, type WaitlistStatus } from "@/src/domain/entities/BookWaitlist";
import { ConflictError } from "@/src/domain/errors/ConflictError";
import type { IBookWaitlistRepository, NewWaitlistEntry } from "@/src/domain/repositories/IBookWaitlistRepository";
import { prisma } from "@/src/infrastructure/prisma/client";
import { inTransaction, type PrismaDb } from "@/src/infrastructure/prisma/transaction";

const OPEN = { in: [...OPEN_WAITLIST_STATUSES] };

/**
 * The book waitlist backed by PostgreSQL via Prisma. A partial unique index keeps
 * a guest in a book's line at most once; telling the next guest is serialized per
 * book with an advisory lock (the same one lending takes).
 */
export class PrismaBookWaitlistRepository implements IBookWaitlistRepository {
  constructor(private readonly db: PrismaDb = prisma) {}

  async join(input: NewWaitlistEntry): Promise<BookWaitlistEntry> {
    try {
      const row = await this.db.bookWaitlistEntry.create({ data: input });
      return toEntry(row);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictError("ALREADY_WAITING", "You're already in line for this book.", { cause: error });
      }
      throw error;
    }
  }

  async getById(id: string): Promise<BookWaitlistEntry | null> {
    const row = await this.db.bookWaitlistEntry.findUnique({ where: { id } });
    return row ? toEntry(row) : null;
  }

  async listForUser(userId: string): Promise<BookWaitlistEntry[]> {
    const rows = await this.db.bookWaitlistEntry.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 50 });
    return rows.map(toEntry);
  }

  async listOpenForBook(productId: string): Promise<BookWaitlistEntry[]> {
    const rows = await this.db.bookWaitlistEntry.findMany({ where: { productId, status: OPEN }, orderBy: { createdAt: "asc" } });
    return rows.map(toEntry);
  }

  async listOpen(): Promise<BookWaitlistEntry[]> {
    const rows = await this.db.bookWaitlistEntry.findMany({
      where: { status: OPEN },
      orderBy: [{ bookTitle: "asc" }, { productId: "asc" }, { createdAt: "asc" }],
      take: 200,
    });
    return rows.map(toEntry);
  }

  async cancel(id: string): Promise<BookWaitlistEntry | null> {
    const result = await this.db.bookWaitlistEntry.updateMany({ where: { id, status: OPEN }, data: { status: "cancelled" } });
    if (result.count === 0) return null;
    return toEntry(await this.db.bookWaitlistEntry.findUniqueOrThrow({ where: { id } }));
  }

  async notifyNext(productId: string, at: Date): Promise<BookWaitlistEntry | null> {
    return inTransaction(this.db, async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`book-waitlist:${productId}`}))`;
      const next = await tx.bookWaitlistEntry.findFirst({ where: { productId, status: "waiting" }, orderBy: { createdAt: "asc" } });
      if (!next) return null;
      const row = await tx.bookWaitlistEntry.update({ where: { id: next.id }, data: { status: "notified", notifiedAt: at } });
      return toEntry(row);
    });
  }

  async fulfill(productId: string, borrower: { userId?: string; phone: string }): Promise<void> {
    await this.db.bookWaitlistEntry.updateMany({
      where: {
        productId,
        status: OPEN,
        OR: [{ guestPhone: borrower.phone }, ...(borrower.userId ? [{ userId: borrower.userId }] : [])],
      },
      data: { status: "fulfilled" },
    });
  }
}

type EntryRow = Prisma.BookWaitlistEntryGetPayload<object>;

function toStatus(value: string): WaitlistStatus {
  return (WAITLIST_STATUSES as readonly string[]).includes(value) ? (value as WaitlistStatus) : "waiting";
}

function toEntry(row: EntryRow): BookWaitlistEntry {
  return {
    id: row.id,
    productId: row.productId,
    bookTitle: row.bookTitle,
    userId: row.userId,
    guestName: row.guestName,
    guestPhone: row.guestPhone,
    status: toStatus(row.status),
    notifiedAt: row.notifiedAt?.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
