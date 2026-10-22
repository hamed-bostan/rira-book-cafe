import { describe, expect, it, vi } from "vitest";

import { ValidationError } from "../../../errors/ValidationError";
import { AddToBookWaitlist, JoinBookWaitlist, RemoveFromBookWaitlist } from "../BookWaitlist";
import { ExtendBookLoan } from "../ChangeBookLoan";

import type { BookLoan } from "../../../entities/BookLoan";
import type { BookWaitlistEntry } from "../../../entities/BookWaitlist";
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
  it("lets a guest queue behind someone who's been told, even with a copy on the shelf", async () => {
    const join = vi.fn(async () => entry());
    const waitlist = {
      join,
      listOpenForBook: vi.fn(async () => [entry({ id: "w0", status: "notified" })]),
    } as unknown as IBookWaitlistRepository;

    await new JoinBookWaitlist(waitlist, books(2, 1)).execute("b1", { id: "g1", name: "Sara", phone: "09121234567" });

    expect(join).toHaveBeenCalledOnce();
  });

  it("refuses a hold when a copy is free and nobody waits", async () => {
    const waitlist = { listOpenForBook: vi.fn(async () => []) } as unknown as IBookWaitlistRepository;
    await expect(
      new AddToBookWaitlist(waitlist, books(2, 1), { getById: vi.fn() }).execute({
        productId: "b1",
        guestName: "Ali",
        guestPhone: "0912 111 0004",
      }),
    ).rejects.toMatchObject({ code: "BOOK_ON_SHELF" });
  });

  it("adds a counter guest, linking their account when the phone matches one", async () => {
    const join = vi.fn(async () => entry());
    const waitlist = { join, listOpenForBook: vi.fn(async () => []) } as unknown as IBookWaitlistRepository;
    const users = { getById: vi.fn(async (id: string) => (id === "09121110004" ? ({ id } as never) : null)) };

    await new AddToBookWaitlist(waitlist, books(1, 1), users).execute({
      productId: "b1",
      guestName: " Ali Moradi ",
      guestPhone: "0912 111 0004",
    });

    expect(join).toHaveBeenCalledWith({
      productId: "b1",
      bookTitle: "Savushun",
      userId: "09121110004",
      guestName: "Ali Moradi",
      guestPhone: "09121110004",
    });
  });

  it("checks the guest's name and phone", async () => {
    const waitlist = {} as IBookWaitlistRepository;
    await expect(
      new AddToBookWaitlist(waitlist, books(1, 1), { getById: vi.fn() }).execute({
        productId: "b1",
        guestName: "Ali",
        guestPhone: "12",
      }),
    ).rejects.toBeInstanceOf(ValidationError);
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
    const { waitlist, notifyNext } = repo(entry({ status: "notified" }), entry({ id: "w2", userId: "g2" }));
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
