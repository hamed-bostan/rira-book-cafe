import { describe, expect, it, vi } from "vitest";

import { isBookLoanOverdue, lendingCopiesChange, type BookLoan, type BookLoanStatus } from "../../../entities/BookLoan";
import { shiftLendingCopies } from "../../../entities/Product";
import { ConflictError } from "../../../errors/ConflictError";
import { NotFoundError } from "../../../errors/NotFoundError";
import { ValidationError } from "../../../errors/ValidationError";
import { ChangeBookLoan } from "../ChangeBookLoan";
import { LendBook, LendHeldBook } from "../LendBook";

import type { BookWaitlistEntry } from "../../../entities/BookWaitlist";
import type { BookLoanStatusChange, IBookLoanRepository, NewBookLoan } from "../../../repositories/IBookLoanRepository";
import type { IUserRepository } from "../../../repositories/IUserRepository";

// 13:30 in Tehran on 2026-10-20.
const NOW = new Date("2026-10-20T10:00:00Z");
const STAFF = { id: "s1", name: "Ali" };

function loan(status: BookLoanStatus, overrides: Partial<BookLoan> = {}): BookLoan {
  return {
    id: "l1",
    reference: 7,
    productId: "b1",
    bookTitle: "The Blind Owl",
    userId: undefined,
    borrowerName: "Sara",
    borrowerPhone: "09121234567",
    lentAt: NOW.toISOString(),
    dueAt: "2026-11-03T20:29:59.999Z",
    status,
    depositAmount: 0,
    lentById: "s1",
    lentByName: "Ali",
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...overrides,
  };
}

function repoWith(
  current: BookLoan | null,
  book: { title: string; author?: string } | null = { title: "The Blind Owl", author: "Hedayat" },
) {
  const create = vi.fn(
    async (
      input: NewBookLoan,
      _audit?: (saved: BookLoan) => unknown,
      _ledger?: unknown,
      _skipAudit?: (skipped: BookWaitlistEntry) => unknown,
    ) => ({
      ...loan("out"),
      ...input,
    }),
  );
  const applyStatus = vi.fn(
    async (
      _id: string,
      _expected: BookLoanStatus,
      status: BookLoanStatus,
      _at: Date,
      _audit?: (change: BookLoanStatusChange) => unknown,
    ) => ({
      ...(current as BookLoan),
      status,
    }),
  );
  const repo = {
    getById: vi.fn(async () => current),
    getBook: vi.fn(async () => book),
    create,
    applyStatus,
  } as unknown as IBookLoanRepository;
  return { repo, create, applyStatus };
}

function usersWith(ids: string[]): Pick<IUserRepository, "getById"> {
  return { getById: vi.fn(async (id: string) => (ids.includes(id) ? ({ id } as never) : null)) };
}

describe("LendBook", () => {
  it("records a loan due at the end of the cafe day, snapshotting the book and linking the account", async () => {
    const { repo, create } = repoWith(null);
    await new LendBook(repo, usersWith(["09121234567"])).execute(
      { productId: "b1", borrowerName: " Sara ", borrowerPhone: "+98 912 123 4567", dueOn: "2026-10-27" },
      STAFF,
      NOW,
    );

    const input = create.mock.calls[0][0];
    expect(input).toMatchObject({
      bookTitle: "The Blind Owl",
      bookAuthor: "Hedayat",
      borrowerName: "Sara",
      borrowerPhone: "09121234567",
      userId: "09121234567",
      depositAmount: 0,
      lentById: "s1",
      // 23:59:59.999 Tehran time on the due day.
      dueAt: "2026-10-27T20:29:59.999Z",
    });
    const entry = create.mock.calls[0][1]?.(loan("out", { reference: 9 })) as { action: string; entityLabel: string };
    expect(entry).toMatchObject({ action: "bookLoan.lent", entityLabel: "L-9" });
  });

  it("logs each told guest the loan skips, by the hold it closed", async () => {
    const { repo, create } = repoWith(null);
    await new LendBook(repo, usersWith([])).execute(
      { productId: "b1", borrowerName: "Reza", borrowerPhone: "09350000000" },
      STAFF,
      NOW,
    );

    const skipped = {
      id: "w1",
      productId: "b1",
      bookTitle: "The Blind Owl",
      guestName: "Sara",
      guestPhone: "09351112233",
      status: "cancelled" as const,
      createdAt: NOW.toISOString(),
      updatedAt: NOW.toISOString(),
    };
    expect(create.mock.calls[0][3]?.(skipped)).toEqual({
      actorId: "s1",
      actorName: "Ali",
      action: "bookLoan.holdSkipped",
      entityType: "bookLoan",
      entityId: "w1",
      entityLabel: "Sara (The Blind Owl)",
      changes: [{ field: "status", before: "notified", after: "cancelled" }],
    });
  });

  it("defaults the due date to two weeks and leaves walk-ins unlinked", async () => {
    const { repo, create } = repoWith(null);
    await new LendBook(repo, usersWith([])).execute(
      { productId: "b1", borrowerName: "Reza", borrowerPhone: "09350000000" },
      STAFF,
      NOW,
    );
    expect(create.mock.calls[0][0]).toMatchObject({ userId: undefined, dueAt: "2026-11-03T20:29:59.999Z" });
  });

  it("refuses a missing name, a bad phone, past or too-late due dates, and non-books", async () => {
    const base = { productId: "b1", borrowerName: "Sara", borrowerPhone: "09121234567" };
    for (const input of [
      { ...base, borrowerName: "  " },
      { ...base, borrowerPhone: "123" },
      { ...base, dueOn: "2026-10-19" },
      { ...base, dueOn: "2027-01-30" },
    ]) {
      await expect(new LendBook(repoWith(null).repo, usersWith([])).execute(input, STAFF, NOW)).rejects.toThrow(
        ValidationError,
      );
    }
    await expect(new LendBook(repoWith(null, null).repo, usersWith([])).execute(base, STAFF, NOW)).rejects.toThrow(
      ValidationError,
    );
  });
});

describe("LendHeldBook", () => {
  const hold: BookWaitlistEntry = {
    id: "w1",
    productId: "b1",
    bookTitle: "The Blind Owl",
    userId: "09351112233",
    guestName: "Sara Ahmadi",
    guestPhone: "09351112233",
    status: "notified",
    notifiedAt: NOW.toISOString(),
    pickupBy: "2026-10-23T20:29:59.999Z",
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
  };
  const holds = (current: BookWaitlistEntry | null) => ({ getById: vi.fn(async () => current) });

  it("lends the book to the hold's guest, by their phone so their profile, on the terms staff chose", async () => {
    const { repo, create } = repoWith(null);
    const lendBook = new LendBook(repo, usersWith(["09351112233"]));
    await new LendHeldBook(holds(hold), lendBook).execute(
      "w1",
      { dueOn: "2026-11-10", note: " Spine creased ", depositAmount: 500000, depositMethod: "cash" },
      STAFF,
      NOW,
    );

    expect(create.mock.calls[0][0]).toMatchObject({
      productId: "b1",
      borrowerName: "Sara Ahmadi",
      borrowerPhone: "09351112233",
      userId: "09351112233",
      note: "Spine creased",
      depositAmount: 500000,
      depositMethod: "cash",
      // 21 days: the end of 10 Nov in Tehran.
      dueAt: "2026-11-10T20:29:59.999Z",
    });
    // Logged and booked as any loan is: the deposit held, not earned.
    expect(create.mock.calls[0][1]?.(loan("out", { reference: 4 }))).toMatchObject({ action: "bookLoan.lent" });
    const ledger = create.mock.calls[0][2] as (saved: BookLoan) => { lines: { accountCode: string }[] }[];
    const [entry] = ledger(loan("out", { id: "l9", reference: 4, depositAmount: 500000, depositMethod: "cash" }));
    expect(entry.lines.map((line) => line.accountCode)).toEqual(["1110", "2400"]);
  });

  it("refuses a hold that's no longer ready to collect, and one that's gone", async () => {
    for (const status of ["waiting", "fulfilled", "cancelled"] as const) {
      const { repo, create } = repoWith(null);
      await expect(
        new LendHeldBook(holds({ ...hold, status }), new LendBook(repo, usersWith([]))).execute(
          "w1",
          { dueOn: "2026-11-03" },
          STAFF,
          NOW,
        ),
      ).rejects.toMatchObject({ code: "HOLD_NOT_READY" });
      expect(create).not.toHaveBeenCalled();
    }
    await expect(
      new LendHeldBook(holds(null), new LendBook(repoWith(null).repo, usersWith([]))).execute(
        "w9",
        { dueOn: "2026-11-03" },
        STAFF,
        NOW,
      ),
    ).rejects.toThrow(NotFoundError);
  });
});

describe("ChangeBookLoan", () => {
  it("marks a loan returned and audits the status change", async () => {
    const { repo, applyStatus } = repoWith(loan("out"));
    await new ChangeBookLoan(repo).execute("l1", "returned", STAFF, NOW);

    expect(applyStatus.mock.calls[0].slice(0, 4)).toEqual(["l1", "out", "returned", NOW]);
    const entry = applyStatus.mock.calls[0][4]?.({ loan: loan("returned") }) as { action: string; changes: unknown[] };
    expect(entry.action).toBe("bookLoan.returned");
    expect(entry.changes).toEqual([{ field: "status", before: "out", after: "returned" }]);
  });

  it("logs a lost copy coming off the shelf with the status change", async () => {
    const { repo, applyStatus } = repoWith(loan("out"));
    await new ChangeBookLoan(repo).execute("l1", "lost", STAFF, NOW);

    const entry = applyStatus.mock.calls[0][4]?.({
      loan: loan("lost"),
      copies: { before: 2, after: 1 },
    }) as { action: string; changes: unknown[] };
    expect(entry.action).toBe("bookLoan.lost");
    expect(entry.changes).toEqual([
      { field: "status", before: "out", after: "lost" },
      { field: "bookCopies", before: "2", after: "1" },
    ]);
  });

  it("lets a lost book come back, but never reopens a returned one", async () => {
    await expect(
      new ChangeBookLoan(repoWith(loan("lost")).repo).execute("l1", "returned", STAFF, NOW),
    ).resolves.toMatchObject({
      status: "returned",
    });
    await expect(new ChangeBookLoan(repoWith(loan("returned")).repo).execute("l1", "out", STAFF, NOW)).rejects.toThrow(
      ConflictError,
    );
  });

  it("reads a missing loan as not found", async () => {
    await expect(new ChangeBookLoan(repoWith(null).repo).execute("nope", "returned", STAFF, NOW)).rejects.toThrow(
      NotFoundError,
    );
  });
});

describe("lost copies", () => {
  it("takes a copy off the shelf when it's lost and puts it back when it turns up", () => {
    expect(lendingCopiesChange("out", "lost")).toBe(-1);
    expect(lendingCopiesChange("lost", "returned")).toBe(1);
    expect(lendingCopiesChange("out", "returned")).toBe(0);
  });

  it("keeps the copies to lend between none and the most the shelf tracks", () => {
    expect(shiftLendingCopies(1, -1)).toBe(0);
    expect(shiftLendingCopies(0, -1)).toBe(0);
    expect(shiftLendingCopies(0, 1)).toBe(1);
    expect(shiftLendingCopies(20, 1)).toBe(20);
  });
});

describe("isBookLoanOverdue", () => {
  it("is overdue only while out and past due", () => {
    const due = { dueAt: "2026-10-19T20:29:59.999Z" };
    expect(isBookLoanOverdue({ status: "out", ...due }, NOW)).toBe(true);
    expect(isBookLoanOverdue({ status: "returned", ...due }, NOW)).toBe(false);
    expect(isBookLoanOverdue({ status: "out", dueAt: "2026-10-20T20:29:59.999Z" }, NOW)).toBe(false);
  });
});
