import { BOOK_LOAN_STATUSES, type BookLoan, type BookLoanStatus } from "@/src/domain/entities/BookLoan";
import { ConflictError } from "@/src/domain/errors/ConflictError";
import { NotFoundError } from "@/src/domain/errors/NotFoundError";
import type { AuditHook } from "@/src/domain/repositories/AuditHook";
import type {
  BookLoanFilters,
  IBookLoanRepository,
  LendableBook,
  NewBookLoan,
} from "@/src/domain/repositories/IBookLoanRepository";
import { prisma } from "@/src/infrastructure/prisma/client";
import type { Prisma } from "@/src/infrastructure/prisma/generated/client";
import { inTransaction, type PrismaDb } from "@/src/infrastructure/prisma/transaction";

import { recordAudit } from "./writeActivityEntry";

/** The dashboard list is a working view, not an archive — older history stays searchable. */
const LIST_LIMIT = 200;

/**
 * Book loans backed by PostgreSQL via Prisma. Server-side only, bound through the
 * container — never imported by client code.
 */
export class PrismaBookLoanRepository implements IBookLoanRepository {
  constructor(private readonly db: PrismaDb = prisma) {}

  async create(input: NewBookLoan, audit?: AuditHook<BookLoan>): Promise<BookLoan> {
    return inTransaction(this.db, async (tx) => {
      // Serialize loans of this book so the duplicate check below can't race (the
      // database trigger takes the same lock and repeats the check as a backstop).
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`book-loan:${input.productId}`}))`;
      const existing = await tx.bookLoan.findFirst({
        where: { productId: input.productId, borrowerPhone: input.borrowerPhone, status: "out" },
      });
      if (existing) {
        throw new ConflictError("ALREADY_ON_LOAN", `This borrower already has this book (L-${existing.reference}).`);
      }

      const row = await tx.bookLoan.create({
        data: {
          productId: input.productId,
          bookTitle: input.bookTitle,
          bookAuthor: input.bookAuthor ?? null,
          userId: input.userId ?? null,
          borrowerName: input.borrowerName,
          borrowerPhone: input.borrowerPhone,
          lentAt: new Date(input.lentAt),
          dueAt: new Date(input.dueAt),
          note: input.note ?? null,
          lentById: input.lentById,
          lentByName: input.lentByName,
        },
      });
      const saved = toBookLoan(row);
      await recordAudit(tx, saved, audit);
      return saved;
    });
  }

  async getById(id: string): Promise<BookLoan | null> {
    const row = await this.db.bookLoan.findUnique({ where: { id } });
    return row ? toBookLoan(row) : null;
  }

  async list(filters: BookLoanFilters, now: Date): Promise<BookLoan[]> {
    const where: Prisma.BookLoanWhereInput = {};
    let orderBy: Prisma.BookLoanOrderByWithRelationInput[] = [{ lentAt: "desc" }];

    switch (filters.view) {
      case "open":
        where.status = "out";
        orderBy = [{ dueAt: "asc" }, { reference: "asc" }];
        break;
      case "overdue":
        where.status = "out";
        where.dueAt = { lt: now };
        orderBy = [{ dueAt: "asc" }, { reference: "asc" }];
        break;
      case "returned":
        where.status = "returned";
        orderBy = [{ returnedAt: "desc" }];
        break;
      case "lost":
        where.status = "lost";
        break;
      case "all":
        break;
    }

    if (filters.q) {
      const digits = filters.q.replace(/\D/g, "");
      where.OR = [
        { borrowerName: { contains: filters.q, mode: "insensitive" } },
        { bookTitle: { contains: filters.q, mode: "insensitive" } },
        ...(digits ? [{ borrowerPhone: { contains: digits } }] : []),
      ];
    }

    const rows = await this.db.bookLoan.findMany({ where, orderBy, take: LIST_LIMIT });
    return rows.map(toBookLoan);
  }

  async listForUser(userId: string): Promise<BookLoan[]> {
    const rows = await this.db.bookLoan.findMany({ where: { userId }, orderBy: { lentAt: "desc" } });
    return rows.map(toBookLoan);
  }

  async listLendableBooks(): Promise<LendableBook[]> {
    const [books, open] = await Promise.all([
      this.db.product.findMany({
        where: { kind: "book" },
        select: { id: true, name: true, bookAuthor: true },
        orderBy: { name: "asc" },
      }),
      this.db.bookLoan.groupBy({ by: ["productId"], where: { status: "out" }, _count: { _all: true } }),
    ]);
    const onLoan = new Map(open.map((group) => [group.productId, group._count._all]));
    return books.map((book) => ({
      id: book.id,
      title: book.name,
      author: book.bookAuthor ?? undefined,
      onLoan: onLoan.get(book.id) ?? 0,
    }));
  }

  countOpenForBook(productId: string): Promise<number> {
    return this.db.bookLoan.count({ where: { productId, status: "out" } });
  }

  async getBook(productId: string): Promise<{ title: string; author?: string } | null> {
    const book = await this.db.product.findFirst({
      where: { id: productId, kind: "book" },
      select: { name: true, bookAuthor: true },
    });
    return book ? { title: book.name, author: book.bookAuthor ?? undefined } : null;
  }

  async applyStatus(
    id: string,
    expectedStatus: BookLoanStatus,
    status: BookLoanStatus,
    at: Date,
    audit?: AuditHook<BookLoan>,
  ): Promise<BookLoan> {
    return inTransaction(this.db, async (tx) => {
      // Guarded on the status the caller read: a concurrent change makes this match nothing.
      const result = await tx.bookLoan.updateMany({
        where: { id, status: expectedStatus },
        data: { status, returnedAt: status === "returned" ? at : null },
      });
      if (result.count === 0) {
        if (!(await tx.bookLoan.findUnique({ where: { id }, select: { id: true } })))
          throw new NotFoundError("book loan", id);
        throw new ConflictError("INVALID_TRANSITION", "This loan was just changed by someone else.");
      }

      const saved = toBookLoan(await tx.bookLoan.findUniqueOrThrow({ where: { id } }));
      await recordAudit(tx, saved, audit);
      return saved;
    });
  }
}

type BookLoanRow = Prisma.BookLoanGetPayload<object>;

function toStatus(value: string): BookLoanStatus {
  return (BOOK_LOAN_STATUSES as readonly string[]).includes(value) ? (value as BookLoanStatus) : "out";
}

function toBookLoan(row: BookLoanRow): BookLoan {
  return {
    id: row.id,
    reference: row.reference,
    productId: row.productId,
    bookTitle: row.bookTitle,
    bookAuthor: row.bookAuthor ?? undefined,
    userId: row.userId ?? undefined,
    borrowerName: row.borrowerName,
    borrowerPhone: row.borrowerPhone,
    lentAt: row.lentAt.toISOString(),
    dueAt: row.dueAt.toISOString(),
    status: toStatus(row.status),
    returnedAt: row.returnedAt?.toISOString(),
    note: row.note ?? undefined,
    lentById: row.lentById,
    lentByName: row.lentByName,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
