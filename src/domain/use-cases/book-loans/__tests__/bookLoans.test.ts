import { describe, expect, it, vi } from "vitest";

import { isBookLoanOverdue, type BookLoan, type BookLoanStatus } from "../../../entities/BookLoan";
import { ConflictError } from "../../../errors/ConflictError";
import { NotFoundError } from "../../../errors/NotFoundError";
import { ValidationError } from "../../../errors/ValidationError";
import { ChangeBookLoan } from "../ChangeBookLoan";
import { LendBook } from "../LendBook";

import type { IBookLoanRepository, NewBookLoan } from "../../../repositories/IBookLoanRepository";
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
  const create = vi.fn(async (input: NewBookLoan, _audit?: (saved: BookLoan) => unknown) => ({
    ...loan("out"),
    ...input,
  }));
  const applyStatus = vi.fn(
    async (
      _id: string,
      _expected: BookLoanStatus,
      status: BookLoanStatus,
      _at: Date,
      _audit?: (saved: BookLoan) => unknown,
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
      lentById: "s1",
      // 23:59:59.999 Tehran time on the due day.
      dueAt: "2026-10-27T20:29:59.999Z",
    });
    const entry = create.mock.calls[0][1]?.(loan("out", { reference: 9 })) as { action: string; entityLabel: string };
    expect(entry).toMatchObject({ action: "bookLoan.lent", entityLabel: "L-9" });
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

describe("ChangeBookLoan", () => {
  it("marks a loan returned and audits the status change", async () => {
    const { repo, applyStatus } = repoWith(loan("out"));
    await new ChangeBookLoan(repo).execute("l1", "returned", STAFF, NOW);

    expect(applyStatus.mock.calls[0].slice(0, 4)).toEqual(["l1", "out", "returned", NOW]);
    const entry = applyStatus.mock.calls[0][4]?.(loan("returned")) as { action: string; changes: unknown[] };
    expect(entry.action).toBe("bookLoan.returned");
    expect(entry.changes).toEqual([{ field: "status", before: "out", after: "returned" }]);
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

describe("isBookLoanOverdue", () => {
  it("is overdue only while out and past due", () => {
    const due = { dueAt: "2026-10-19T20:29:59.999Z" };
    expect(isBookLoanOverdue({ status: "out", ...due }, NOW)).toBe(true);
    expect(isBookLoanOverdue({ status: "returned", ...due }, NOW)).toBe(false);
    expect(isBookLoanOverdue({ status: "out", dueAt: "2026-10-20T20:29:59.999Z" }, NOW)).toBe(false);
  });
});
