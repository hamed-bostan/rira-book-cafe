import {
  BOOK_LOAN_STATUSES,
  LOAN_DEPOSIT_METHODS,
  LOAN_DEPOSIT_STATES,
  depositStateFor,
  lendingCopiesChange,
  type BookLoan,
  type BookLoanStatus,
  type LoanDepositMethod,
  type LoanDepositState,
} from "@/src/domain/entities/BookLoan";
import { holdsSkippedByLoan, type BookWaitlistEntry } from "@/src/domain/entities/BookWaitlist";
import { createPage, toSkipTake, type Page, type PageRequest } from "@/src/domain/entities/Pagination";
import { lendingCopies, shiftLendingCopies } from "@/src/domain/entities/Product";
import { ConflictError } from "@/src/domain/errors/ConflictError";
import { NotFoundError } from "@/src/domain/errors/NotFoundError";
import type { AuditHook } from "@/src/domain/repositories/AuditHook";
import type {
  BookLoanCounts,
  BookLoanFilters,
  BookLoanStatusChange,
  IBookLoanRepository,
  LendableBook,
  NewBookLoan,
} from "@/src/domain/repositories/IBookLoanRepository";
import type { LedgerHook } from "@/src/domain/repositories/ILedgerRepository";
import { prisma } from "@/src/infrastructure/prisma/client";
import type { Prisma } from "@/src/infrastructure/prisma/generated/client";
import { inTransaction, type PrismaDb } from "@/src/infrastructure/prisma/transaction";

import { OPEN_HOLD, lockBookShelf, toWaitlistEntry } from "./bookShelf";
import { recordAudit } from "./writeActivityEntry";
import { createGuestProfile } from "./writeGuestProfile";
import { postHook } from "./writeJournal";

/** Soonest due first — so the late ones lead — then in the order they went out. */
const DUE_FIRST: Prisma.BookLoanOrderByWithRelationInput[] = [{ dueAt: "asc" }, { reference: "asc" }];
/** Most recently lent first. */
const NEWEST_FIRST: Prisma.BookLoanOrderByWithRelationInput[] = [{ lentAt: "desc" }, { reference: "desc" }];

/**
 * Book loans backed by PostgreSQL via Prisma. Server-side only, bound through the
 * container — never imported by client code.
 */
export class PrismaBookLoanRepository implements IBookLoanRepository {
  constructor(private readonly db: PrismaDb = prisma) {}

  async create(
    input: NewBookLoan,
    audit?: AuditHook<BookLoan>,
    ledger?: LedgerHook<BookLoan>,
    skipAudit?: AuditHook<BookWaitlistEntry>,
  ): Promise<BookLoan> {
    return inTransaction(this.db, async (tx) => {
      // Serialize loans of this book so the duplicate check below can't race (the
      // database trigger takes the same lock and repeats the check as a backstop),
      // and so the line can't move while this loan takes its copy.
      await lockBookShelf(tx, input.productId);
      const existing = await tx.bookLoan.findFirst({
        where: { productId: input.productId, borrowerPhone: input.borrowerPhone, status: "out" },
      });
      if (existing) {
        throw new ConflictError("ALREADY_ON_LOAN", `This borrower already has this book (L-${existing.reference}).`);
      }
      // Every copy out: there's nothing on the shelf to hand over.
      const [book, out, told] = await Promise.all([
        tx.product.findUnique({ where: { id: input.productId }, select: { bookCopies: true } }),
        tx.bookLoan.count({ where: { productId: input.productId, status: "out" } }),
        tx.bookWaitlistEntry.findMany({
          where: { productId: input.productId, status: "notified" },
          orderBy: [{ notifiedAt: "asc" }, { createdAt: "asc" }],
        }),
      ]);
      const copies = lendingCopies({ copies: book?.bookCopies ?? undefined });
      if (out >= copies) {
        throw new ConflictError("ALL_COPIES_OUT", "Every copy of this book is out. Add the guest to its line instead.");
      }
      const borrower = { userId: input.userId, phone: input.borrowerPhone };
      const skipped = holdsSkippedByLoan(copies - out, told.map(toWaitlistEntry), borrower);

      // A new guest's profile goes in with the loan: a loan refused above leaves none.
      await createGuestProfile(tx, input.newGuest);
      const row = await tx.bookLoan.create({
        data: {
          productId: input.productId,
          bookTitle: input.bookTitle,
          bookAuthor: input.bookAuthor ?? null,
          userId: input.userId,
          borrowerName: input.borrowerName,
          borrowerPhone: input.borrowerPhone,
          lentAt: new Date(input.lentAt),
          dueAt: new Date(input.dueAt),
          note: input.note ?? null,
          depositAmount: BigInt(input.depositAmount),
          depositMethod: input.depositAmount > 0 ? (input.depositMethod ?? null) : null,
          depositState: input.depositAmount > 0 ? "held" : null,
          lentById: input.lentById,
          lentByName: input.lentByName,
        },
      });
      const saved = toBookLoan(row);

      // The borrower has the book now: their place in its line is done.
      await tx.bookWaitlistEntry.updateMany({
        where: {
          productId: input.productId,
          status: OPEN_HOLD,
          OR: [{ guestPhone: borrower.phone }, ...(borrower.userId ? [{ userId: borrower.userId }] : [])],
        },
        data: { status: "fulfilled" },
      });
      // The copy held for a told guest went to someone else: they're skipped, as staff
      // would — nobody new is told, there's no copy left to tell them about.
      for (const entry of skipped) {
        const result = await tx.bookWaitlistEntry.updateMany({
          where: { id: entry.id, status: "notified" },
          data: { status: "cancelled" },
        });
        if (result.count === 0) continue;
        const cancelled = toWaitlistEntry(await tx.bookWaitlistEntry.findUniqueOrThrow({ where: { id: entry.id } }));
        await recordAudit(tx, cancelled, skipAudit);
      }

      await recordAudit(tx, saved, audit);
      await postHook(tx, saved, ledger);
      return saved;
    });
  }

  async getById(id: string): Promise<BookLoan | null> {
    const row = await this.db.bookLoan.findUnique({ where: { id } });
    return row ? toBookLoan(row) : null;
  }

  async list(filters: BookLoanFilters, request: PageRequest, now: Date): Promise<Page<BookLoan>> {
    const search = searchWhere(filters.q);
    const inView = (where: Prisma.BookLoanWhereInput): Prisma.BookLoanWhereInput => ({ AND: [search, where] });

    switch (filters.view) {
      case "open":
        return this.pageOf(inView({ status: "out" }), DUE_FIRST, request);
      case "overdue":
        return this.pageOf(inView({ status: "out", dueAt: { lt: now } }), DUE_FIRST, request);
      case "returned":
        return this.pageOf(inView({ status: "returned" }), [{ returnedAt: "desc" }, { reference: "desc" }], request);
      case "lost":
        return this.pageOf(inView({ status: "lost" }), NEWEST_FIRST, request);
      case "all": {
        // Two runs end to end — what's still out, then what's closed — paged as one list.
        const out = inView({ status: "out" });
        const closed = inView({ status: { not: "out" } });
        const { skip, take } = toSkipTake(request);
        const [outTotal, closedTotal] = await Promise.all([
          this.db.bookLoan.count({ where: out }),
          this.db.bookLoan.count({ where: closed }),
        ]);
        const outRows =
          skip < outTotal ? await this.db.bookLoan.findMany({ where: out, orderBy: DUE_FIRST, skip, take }) : [];
        const closedRows =
          outRows.length < take
            ? await this.db.bookLoan.findMany({
                where: closed,
                orderBy: NEWEST_FIRST,
                skip: Math.max(0, skip - outTotal),
                take: take - outRows.length,
              })
            : [];
        return createPage([...outRows, ...closedRows].map(toBookLoan), outTotal + closedTotal, request);
      }
    }
  }

  /** One page of the loans `where` matches, in `orderBy`, with how many match in all. */
  private async pageOf(
    where: Prisma.BookLoanWhereInput,
    orderBy: Prisma.BookLoanOrderByWithRelationInput[],
    request: PageRequest,
  ): Promise<Page<BookLoan>> {
    const [rows, total] = await Promise.all([
      this.db.bookLoan.findMany({ where, orderBy, ...toSkipTake(request) }),
      this.db.bookLoan.count({ where }),
    ]);
    return createPage(rows.map(toBookLoan), total, request);
  }

  async countByView(now: Date): Promise<BookLoanCounts> {
    const [byStatus, overdue] = await Promise.all([
      this.db.bookLoan.groupBy({ by: ["status"], _count: { _all: true } }),
      this.db.bookLoan.count({ where: { status: "out", dueAt: { lt: now } } }),
    ]);
    const counted = (status: BookLoanStatus): number =>
      byStatus.find((group) => group.status === status)?._count._all ?? 0;
    return {
      open: counted("out"),
      overdue,
      returned: counted("returned"),
      lost: counted("lost"),
      all: byStatus.reduce((total, group) => total + group._count._all, 0),
    };
  }

  async listForUser(userId: string): Promise<BookLoan[]> {
    const rows = await this.db.bookLoan.findMany({ where: { userId }, orderBy: { lentAt: "desc" } });
    return rows.map(toBookLoan);
  }

  async listOutDueBefore(before: Date): Promise<BookLoan[]> {
    const rows = await this.db.bookLoan.findMany({
      where: { status: "out", dueAt: { lt: before } },
      orderBy: DUE_FIRST,
    });
    return rows.map(toBookLoan);
  }

  async listLendableBooks(): Promise<LendableBook[]> {
    // Every loan still out, soonest due first: no more than the shelf has copies.
    const [books, open] = await Promise.all([
      this.db.product.findMany({
        where: { kind: "book" },
        select: { id: true, name: true, bookAuthor: true, bookCopies: true },
        orderBy: { name: "asc" },
      }),
      this.db.bookLoan.findMany({
        where: { status: "out" },
        select: { productId: true, reference: true, dueAt: true },
        orderBy: DUE_FIRST,
      }),
    ]);
    const onLoan = new Map<string, number>();
    const nextDue = new Map<string, { reference: number; dueAt: string }>();
    for (const loan of open) {
      onLoan.set(loan.productId, (onLoan.get(loan.productId) ?? 0) + 1);
      if (!nextDue.has(loan.productId)) {
        nextDue.set(loan.productId, { reference: loan.reference, dueAt: loan.dueAt.toISOString() });
      }
    }
    return books.map((book) => ({
      id: book.id,
      title: book.name,
      author: book.bookAuthor ?? undefined,
      onLoan: onLoan.get(book.id) ?? 0,
      copies: lendingCopies({ copies: book.bookCopies ?? undefined }),
      nextDue: nextDue.get(book.id),
    }));
  }

  countOpenForBook(productId: string): Promise<number> {
    return this.db.bookLoan.count({ where: { productId, status: "out" } });
  }

  async getBook(productId: string): Promise<{ title: string; author?: string; copies: number } | null> {
    const book = await this.db.product.findFirst({
      where: { id: productId, kind: "book" },
      select: { name: true, bookAuthor: true, bookCopies: true },
    });
    return book
      ? {
          title: book.name,
          author: book.bookAuthor ?? undefined,
          copies: lendingCopies({ copies: book.bookCopies ?? undefined }),
        }
      : null;
  }

  async extend(id: string, dueAt: string, audit?: AuditHook<BookLoan>): Promise<BookLoan> {
    return inTransaction(this.db, async (tx) => {
      // Only while it's still out: a loan closed meanwhile matches nothing.
      const result = await tx.bookLoan.updateMany({ where: { id, status: "out" }, data: { dueAt: new Date(dueAt) } });
      if (result.count === 0) {
        if (!(await tx.bookLoan.findUnique({ where: { id }, select: { id: true } }))) {
          throw new NotFoundError("book loan", id);
        }
        throw new ConflictError("INVALID_TRANSITION", "This loan was just closed by someone else.");
      }
      const saved = toBookLoan(await tx.bookLoan.findUniqueOrThrow({ where: { id } }));
      await recordAudit(tx, saved, audit);
      return saved;
    });
  }

  async applyStatus(
    id: string,
    expectedStatus: BookLoanStatus,
    status: BookLoanStatus,
    at: Date,
    audit?: AuditHook<BookLoanStatusChange>,
    ledger?: LedgerHook<BookLoan>,
  ): Promise<BookLoan> {
    return inTransaction(this.db, async (tx) => {
      const loan = await tx.bookLoan.findUnique({ where: { id }, select: { productId: true } });
      if (!loan) throw new NotFoundError("book loan", id);
      // A lost or found copy moves the book's copies, which lending reads under this lock.
      await lockBookShelf(tx, loan.productId);

      // Guarded on the status the caller read: a concurrent change makes this match nothing.
      const result = await tx.bookLoan.updateMany({
        where: { id, status: expectedStatus },
        data: { status, returnedAt: status === "returned" ? at : null },
      });
      if (result.count === 0) {
        throw new ConflictError("INVALID_TRANSITION", "This loan was just changed by someone else.");
      }
      await tx.bookLoan.updateMany({
        where: { id, depositAmount: { gt: 0 } },
        data: { depositState: depositStateFor(status) },
      });
      const copies = await moveLendingCopies(tx, loan.productId, lendingCopiesChange(expectedStatus, status));

      const saved = toBookLoan(await tx.bookLoan.findUniqueOrThrow({ where: { id } }));
      await recordAudit(tx, { loan: saved, copies }, audit);
      await postHook(tx, saved, ledger);
      return saved;
    });
  }
}

/**
 * Take copies off (or put them back on) a book's lending shelf; a null count reads
 * as the default. Nothing to move — no change, a product that's gone or no longer
 * a book, a count already at its floor or ceiling — moves nothing and says so.
 */
async function moveLendingCopies(
  tx: Prisma.TransactionClient,
  productId: string,
  change: number,
): Promise<BookLoanStatusChange["copies"]> {
  if (change === 0) return undefined;
  const book = await tx.product.findFirst({ where: { id: productId, kind: "book" }, select: { bookCopies: true } });
  if (!book) return undefined;
  const before = lendingCopies({ copies: book.bookCopies ?? undefined });
  const after = shiftLendingCopies(before, change);
  if (after === before) return undefined;
  await tx.product.update({ where: { id: productId }, data: { bookCopies: after } });
  return { before, after };
}

/** Matches the borrower's name or phone, or the book's title; everything when there's no search. */
function searchWhere(q: string | undefined): Prisma.BookLoanWhereInput {
  if (!q) return {};
  const digits = q.replace(/\D/g, "");
  return {
    OR: [
      { borrowerName: { contains: q, mode: "insensitive" } },
      { bookTitle: { contains: q, mode: "insensitive" } },
      ...(digits ? [{ borrowerPhone: { contains: digits } }] : []),
    ],
  };
}

type BookLoanRow = Prisma.BookLoanGetPayload<object>;

function toStatus(value: string): BookLoanStatus {
  return (BOOK_LOAN_STATUSES as readonly string[]).includes(value) ? (value as BookLoanStatus) : "out";
}

function toDepositMethod(value: string | null): LoanDepositMethod | undefined {
  return value && (LOAN_DEPOSIT_METHODS as readonly string[]).includes(value)
    ? (value as LoanDepositMethod)
    : undefined;
}

function toDepositState(value: string | null): LoanDepositState | undefined {
  return value && (LOAN_DEPOSIT_STATES as readonly string[]).includes(value) ? (value as LoanDepositState) : undefined;
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
    depositAmount: Number(row.depositAmount),
    depositMethod: toDepositMethod(row.depositMethod),
    depositState: toDepositState(row.depositState),
    lentById: row.lentById,
    lentByName: row.lentByName,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
