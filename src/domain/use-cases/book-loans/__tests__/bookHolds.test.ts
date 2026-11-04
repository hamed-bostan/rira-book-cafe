import { describe, expect, it, vi } from "vitest";

import { holdsSkippedByLoan, type BookWaitlistEntry } from "../../../entities/BookWaitlist";
import { NotFoundError } from "../../../errors/NotFoundError";
import { ValidationError } from "../../../errors/ValidationError";
import { AddToBookWaitlist, JoinBookWaitlist, RemoveFromBookWaitlist } from "../BookWaitlist";
import { ExtendBookLoan, UndoBookLoanExtension } from "../ChangeBookLoan";

import type { BookLoan } from "../../../entities/BookLoan";
import type { IBookLoanRepository } from "../../../repositories/IBookLoanRepository";
import type { IBookWaitlistRepository } from "../../../repositories/IBookWaitlistRepository";

// 10:00 on 2026-10-22 in Tehran.
const NOW = new Date("2026-10-22T06:30:00.000Z");
const STAFF = { id: "s1", name: "Yasaman" };

function entry(overrides: Partial<BookWaitlistEntry> = {}): BookWaitlistEntry {
  return {
    id: "w1",
    productId: "b1",
    bookTitle: "Savushun",
    guestName: "Ali Moradi",
    guestPhone: "09121110004",
    status: "waiting",
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...overrides,
  };
}

function books(copies: number, onLoan: number) {
  return {
    getBook: vi.fn(async () => ({ title: "Savushun", copies })),
    countOpenForBook: vi.fn(async () => onLoan),
  };
}

describe("holding a book", () => {
  it("puts a signed-in guest in line on their profile, the shelf's rules left to the repository", async () => {
    const join = vi.fn(async () => entry());

    await new JoinBookWaitlist({ join }, books(2, 1)).execute("b1", {
      id: "09121234567",
      name: "Sara",
      phone: "+98 912 123 4567",
    });

    expect(join).toHaveBeenCalledWith({
      productId: "b1",
      bookTitle: "Savushun",
      userId: "09121234567",
      guestName: "Sara",
      guestPhone: "09121234567",
    });
  });

  it("adds a counter guest on the profile their phone finds, under its name", async () => {
    const join = vi.fn(async () => entry());
    const users = {
      getById: vi.fn(async (id: string) =>
        id === "09121110004" ? ({ id, name: "Ali Moradi", phone: "09121110004" } as never) : null,
      ),
    };

    await new AddToBookWaitlist({ join }, books(1, 1), users).execute(
      { productId: "b1", guestName: "Ali", guestPhone: "0912 111 0004" },
      STAFF,
    );

    expect(join).toHaveBeenCalledWith({
      productId: "b1",
      bookTitle: "Savushun",
      userId: "09121110004",
      newGuest: undefined,
      guestName: "Ali Moradi",
      guestPhone: "09121110004",
    });
  });

  it("makes a new guest's profile with the hold, from the name staff typed", async () => {
    const join = vi.fn(async () => entry());

    await new AddToBookWaitlist({ join }, books(1, 1), { getById: vi.fn(async () => null) }).execute(
      { productId: "b1", guestName: " Sara Ahmadi ", guestPhone: "0935 111 2233" },
      STAFF,
    );

    expect(join).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "09351112233",
        guestName: "Sara Ahmadi",
        guestPhone: "09351112233",
        newGuest: { id: "09351112233", phone: "0935 111 2233", name: "Sara Ahmadi", createdBy: STAFF },
      }),
    );
  });

  it("asks a new guest's name, refuses a bad phone, and holds nothing for what isn't a book", async () => {
    const join = vi.fn();
    const nobody = { getById: vi.fn(async () => null) };
    await expect(
      new AddToBookWaitlist({ join }, books(1, 1), nobody).execute(
        { productId: "b1", guestPhone: "0935 111 2233" },
        STAFF,
      ),
    ).rejects.toMatchObject({ field: "guestName", message: "guestNameNeeded" });
    await expect(
      new AddToBookWaitlist({ join }, books(1, 1), nobody).execute(
        { productId: "b1", guestName: "Ali", guestPhone: "12" },
        STAFF,
      ),
    ).rejects.toBeInstanceOf(ValidationError);
    const noBook = { getBook: vi.fn(async () => null) };
    await expect(
      new AddToBookWaitlist({ join }, noBook, nobody).execute(
        { productId: "x", guestName: "Ali", guestPhone: "09121110004" },
        STAFF,
      ),
    ).rejects.toThrow(NotFoundError);
    expect(join).not.toHaveBeenCalled();
  });
});

describe("lending a copy held for a told guest", () => {
  const sara = entry({ id: "w1", guestName: "Sara", guestPhone: "09351112233", userId: "09351112233" });
  const hamid = entry({ id: "w2", guestName: "Hamid", guestPhone: "09124041180" });

  it("skips the guest told longest ago when the copy goes to someone else", () => {
    expect(holdsSkippedByLoan(1, [sara], { phone: "09121110006" })).toEqual([sara]);
    expect(holdsSkippedByLoan(2, [sara, hamid], { phone: "09121110006" })).toEqual([sara]);
  });

  it("skips nobody when the copy goes to the told guest, by phone or account", () => {
    expect(holdsSkippedByLoan(1, [sara], { phone: "09351112233" })).toEqual([]);
    expect(holdsSkippedByLoan(1, [sara], { userId: "09351112233", phone: "09120000000" })).toEqual([]);
    expect(holdsSkippedByLoan(2, [sara, hamid], { phone: "09124041180" })).toEqual([]);
  });

  it("skips nobody while a copy is free beyond the held ones", () => {
    expect(holdsSkippedByLoan(2, [sara], { phone: "09121110006" })).toEqual([]);
    expect(holdsSkippedByLoan(3, [], { phone: "09121110006" })).toEqual([]);
  });

  it("skips every told guest the loan leaves without a copy", () => {
    expect(holdsSkippedByLoan(1, [sara, hamid], { phone: "09121110006" })).toEqual([sara, hamid]);
  });
});

describe("skipping and removing", () => {
  function repo(current: BookWaitlistEntry, next: BookWaitlistEntry | null) {
    const notifyNext = vi.fn(async () => next);
    const waitlist = {
      getById: vi.fn(async () => current),
      cancel: vi.fn(async () => ({ ...current, status: "cancelled" as const })),
      notifyNext,
    } as unknown as IBookWaitlistRepository;
    return { waitlist, notifyNext };
  }

  it("passes the copy on when the guest who was told is skipped", async () => {
    const { waitlist, notifyNext } = repo(
      entry({ status: "notified", notifiedAt: NOW.toISOString() }),
      entry({ id: "w2", userId: "g2" }),
    );
    const notify = vi.fn(async () => undefined);

    await new RemoveFromBookWaitlist(waitlist, { notify }).execute("w1", NOW);

    expect(notifyNext).toHaveBeenCalledWith("b1", NOW);
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ userId: "g2", kind: "bookAvailable" }));
  });

  it("tells nobody new when a guest still waiting is removed", async () => {
    const { waitlist, notifyNext } = repo(entry(), null);
    await new RemoveFromBookWaitlist(waitlist).execute("w1", NOW);
    expect(notifyNext).not.toHaveBeenCalled();
  });
});

describe("ExtendBookLoan", () => {
  function loan(dueAt: string, status: BookLoan["status"] = "out"): BookLoan {
    return { id: "l1", reference: 2, status, dueAt } as BookLoan;
  }

  function loans(current: BookLoan) {
    const extend = vi.fn<IBookLoanRepository["extend"]>(async (_id, dueAt) => ({ ...current, dueAt }));
    return { repo: { getById: vi.fn(async () => current), extend } as unknown as IBookLoanRepository, extend };
  }

  it("moves the due day on from the current one", async () => {
    // Due by the end of Oct 30 (Tehran).
    const { repo, extend } = loans(loan("2026-10-30T20:29:59.999Z"));
    await new ExtendBookLoan(repo).execute("l1", 7, STAFF, NOW);
    expect(extend.mock.calls[0][1]).toBe("2026-11-06T20:29:59.999Z");
  });

  it("counts from today for a book that's already late", async () => {
    const { repo, extend } = loans(loan("2026-10-15T20:29:59.999Z"));
    await new ExtendBookLoan(repo).execute("l1", 7, STAFF, NOW);
    expect(extend.mock.calls[0][1]).toBe("2026-10-29T20:29:59.999Z");
  });

  it("refuses a loan that's closed and a nonsense length", async () => {
    await expect(
      new ExtendBookLoan(loans(loan("2026-10-30T20:29:59.999Z", "returned")).repo).execute("l1", 7, STAFF, NOW),
    ).rejects.toMatchObject({ code: "INVALID_TRANSITION" });
    await expect(
      new ExtendBookLoan(loans(loan("2026-10-30T20:29:59.999Z")).repo).execute("l1", 0, STAFF, NOW),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("UndoBookLoanExtension", () => {
  const LENT = "2026-10-16T08:00:00.000Z";
  const BEFORE = "2026-10-30T20:29:59.999Z";
  const EXTENDED = "2026-11-06T20:29:59.999Z";

  function loan(dueAt: string, status: BookLoan["status"] = "out"): BookLoan {
    return { id: "l1", reference: 2, status, dueAt, lentAt: LENT } as BookLoan;
  }

  function loans(current: BookLoan) {
    const extend = vi.fn<IBookLoanRepository["extend"]>(async (_id, dueAt) => ({ ...current, dueAt }));
    return { repo: { getById: vi.fn(async () => current), extend } as unknown as IBookLoanRepository, extend };
  }

  it("puts the due date back and logs it like the extension", async () => {
    const { repo, extend } = loans(loan(EXTENDED));
    const saved = await new UndoBookLoanExtension(repo).execute(
      "l1",
      { dueAt: BEFORE, extendedDueAt: EXTENDED },
      STAFF,
    );

    expect(saved.dueAt).toBe(BEFORE);
    expect(extend.mock.calls[0].slice(0, 2)).toEqual(["l1", BEFORE]);
    const entry = extend.mock.calls[0][2]?.(loan(BEFORE)) as {
      action: string;
      entityLabel: string;
      changes: unknown[];
    };
    expect(entry).toMatchObject({ action: "bookLoan.extensionUndone", entityLabel: "L-2" });
    expect(entry.changes).toEqual([{ field: "dueAt", before: EXTENDED, after: BEFORE }]);
  });

  it("puts back a due date that's already past, so the loan is overdue again", async () => {
    // Was due Oct 19, three days before NOW; the extension counted from today.
    const lateBefore = "2026-10-19T20:29:59.999Z";
    const { repo, extend } = loans(loan("2026-10-29T20:29:59.999Z"));
    await new UndoBookLoanExtension(repo).execute(
      "l1",
      { dueAt: lateBefore, extendedDueAt: "2026-10-29T20:29:59.999Z" },
      STAFF,
    );
    expect(extend.mock.calls[0][1]).toBe(lateBefore);
  });

  it("refuses a closed loan, and a due date that has moved since the extension", async () => {
    for (const status of ["returned", "lost"] as const) {
      const { repo, extend } = loans(loan(EXTENDED, status));
      await expect(
        new UndoBookLoanExtension(repo).execute("l1", { dueAt: BEFORE, extendedDueAt: EXTENDED }, STAFF),
      ).rejects.toMatchObject({ code: "INVALID_TRANSITION" });
      expect(extend).not.toHaveBeenCalled();
    }
    const { repo, extend } = loans(loan("2026-11-13T20:29:59.999Z"));
    await expect(
      new UndoBookLoanExtension(repo).execute("l1", { dueAt: BEFORE, extendedDueAt: EXTENDED }, STAFF),
    ).rejects.toMatchObject({ code: "INVALID_TRANSITION" });
    expect(extend).not.toHaveBeenCalled();
  });

  it("only moves the due date earlier, never before the loan began", async () => {
    for (const dueAt of [EXTENDED, "2026-11-20T20:29:59.999Z", "2026-10-15T20:29:59.999Z", "not a time"]) {
      const { repo, extend } = loans(loan(EXTENDED));
      await expect(
        new UndoBookLoanExtension(repo).execute("l1", { dueAt, extendedDueAt: EXTENDED }, STAFF),
      ).rejects.toBeInstanceOf(ValidationError);
      expect(extend).not.toHaveBeenCalled();
    }
  });

  it("reads a missing loan as not found", async () => {
    const repo = { getById: vi.fn(async () => null) } as unknown as IBookLoanRepository;
    await expect(
      new UndoBookLoanExtension(repo).execute("nope", { dueAt: BEFORE, extendedDueAt: EXTENDED }, STAFF),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
