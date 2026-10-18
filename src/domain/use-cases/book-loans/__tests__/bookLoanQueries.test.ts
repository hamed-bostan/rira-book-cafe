import { describe, expect, it, vi } from "vitest";

import { nextBookLoanStatuses, type BookLoan } from "../../../entities/BookLoan";
import { ConflictError } from "../../../errors/ConflictError";
import { NotFoundError } from "../../../errors/NotFoundError";
import { ListBookLoans, ListLendableBooks, ListOwnBookLoans } from "../BookLoanQueries";
import {
  GetBookWaitlistStatus,
  JoinBookWaitlist,
  LeaveBookWaitlist,
  ListBookWaitlist,
  ListOwnBookWaitlist,
  RemoveFromBookWaitlist,
} from "../BookWaitlist";

import type { BookWaitlistEntry } from "../../../entities/BookWaitlist";
import type { IBookLoanRepository } from "../../../repositories/IBookLoanRepository";
import type { IBookWaitlistRepository } from "../../../repositories/IBookWaitlistRepository";

const NOW = new Date("2026-10-20T10:00:00Z");

const LOAN = { id: "l1", reference: 3, productId: "b1", status: "out" } as BookLoan;

function entry(overrides: Partial<BookWaitlistEntry> = {}): BookWaitlistEntry {
  return {
    id: "w1",
    productId: "b1",
    bookTitle: "The Blind Owl",
    userId: "g1",
    guestName: "Sara",
    guestPhone: "09121234567",
    status: "waiting",
    createdAt: "",
    updatedAt: "",
    ...overrides,
  };
}

describe("loan queries", () => {
  it.each<[string | undefined, string | undefined]>([
    ["  Sara ", "Sara"],
    ["  ", undefined],
    [undefined, undefined],
  ])("lists the loan book with the search %j trimmed", async (q, expected) => {
    const list = vi.fn<IBookLoanRepository["list"]>(async () => [LOAN]);
    const repo = { list } as unknown as IBookLoanRepository;
    expect(await new ListBookLoans(repo).execute({ view: "overdue", q }, NOW)).toEqual([LOAN]);
    expect(list).toHaveBeenCalledWith({ view: "overdue", q: expected }, NOW);
  });

  it("delegates the guest's loans and the lendable shelf", async () => {
    const listForUser = vi.fn<IBookLoanRepository["listForUser"]>(async () => [LOAN]);
    const books = [{ id: "b1", title: "The Blind Owl", onLoan: 1 }];
    const repo = { listForUser, listLendableBooks: vi.fn(async () => books) } as unknown as IBookLoanRepository;
    expect(await new ListOwnBookLoans(repo).execute("g1")).toEqual([LOAN]);
    expect(listForUser).toHaveBeenCalledWith("g1");
    expect(await new ListLendableBooks(repo).execute()).toBe(books);
  });

  it("knows where a loan can go next", () => {
    expect(nextBookLoanStatuses("out")).toEqual(["returned", "lost"]);
    expect(nextBookLoanStatuses("returned")).toEqual([]);
  });
});

type WaitlistFake = {
  repo: IBookWaitlistRepository;
  cancel: ReturnType<typeof vi.fn<IBookWaitlistRepository["cancel"]>>;
};

function waitlist(current: BookWaitlistEntry | null, cancelled: BookWaitlistEntry | null = null): WaitlistFake {
  const cancel = vi.fn<IBookWaitlistRepository["cancel"]>(async () => cancelled);
  const repo = {
    getById: vi.fn(async () => current),
    cancel,
    listOpenForBook: vi.fn(async () => [
      entry({ id: "w0", userId: "g0" }),
      entry({ id: "w1", userId: "g1", status: "notified" }),
    ]),
    listForUser: vi.fn(async () => [entry()]),
    listOpen: vi.fn(async () => [entry(), entry({ id: "w2", productId: "b2" })]),
  } as unknown as IBookWaitlistRepository;
  return { repo, cancel };
}

describe("JoinBookWaitlist", () => {
  it("is not found for something that isn't a book", async () => {
    const join = vi.fn();
    const loans = { getBook: vi.fn(async () => null), countOpenForBook: vi.fn(async () => 1) };
    await expect(
      new JoinBookWaitlist({ join } as unknown as IBookWaitlistRepository, loans).execute("x", {
        id: "g1",
        name: "S",
        phone: "0912",
      }),
    ).rejects.toThrow(NotFoundError);
    expect(join).not.toHaveBeenCalled();
  });
});

describe("LeaveBookWaitlist", () => {
  it("cancels the guest's own open entry", async () => {
    const left = entry({ status: "cancelled" });
    const { repo, cancel } = waitlist(entry(), left);
    expect(await new LeaveBookWaitlist(repo).execute("w1", "g1")).toBe(left);
    expect(cancel).toHaveBeenCalledWith("w1");
  });

  it("returns a closed entry as it is", async () => {
    const done = entry({ status: "fulfilled" });
    const { repo, cancel } = waitlist(done);
    expect(await new LeaveBookWaitlist(repo).execute("w1", "g1")).toBe(done);
    expect(cancel).not.toHaveBeenCalled();
  });

  it("falls back to the entry it read when the cancel lost a race", async () => {
    const open = entry();
    expect(await new LeaveBookWaitlist(waitlist(open, null).repo).execute("w1", "g1")).toBe(open);
  });

  it("treats someone else's entry, or none, as not found", async () => {
    await expect(new LeaveBookWaitlist(waitlist(entry({ userId: "other" })).repo).execute("w1", "g1")).rejects.toThrow(
      NotFoundError,
    );
    await expect(new LeaveBookWaitlist(waitlist(null).repo).execute("w1", "g1")).rejects.toThrow(NotFoundError);
  });
});

describe("RemoveFromBookWaitlist", () => {
  it("takes an open entry out of line", async () => {
    const removed = entry({ status: "cancelled" });
    const { repo, cancel } = waitlist(entry({ status: "notified" }), removed);
    expect(await new RemoveFromBookWaitlist(repo).execute("w1")).toBe(removed);
    expect(cancel).toHaveBeenCalledWith("w1");
  });

  it("falls back to the entry it read when the cancel returns nothing", async () => {
    const open = entry();
    expect(await new RemoveFromBookWaitlist(waitlist(open, null).repo).execute("w1")).toBe(open);
  });

  it("refuses an unknown entry and one that's already closed", async () => {
    await expect(new RemoveFromBookWaitlist(waitlist(null).repo).execute("w1")).rejects.toThrow(NotFoundError);
    await expect(
      new RemoveFromBookWaitlist(waitlist(entry({ status: "cancelled" })).repo).execute("w1"),
    ).rejects.toMatchObject({
      code: "INVALID_TRANSITION",
    });
    await expect(
      new RemoveFromBookWaitlist(waitlist(entry({ status: "fulfilled" })).repo).execute("w1"),
    ).rejects.toThrow(ConflictError);
  });
});

describe("GetBookWaitlistStatus", () => {
  const loans = { countOpenForBook: vi.fn(async () => 2) };

  it("gives the guest their place in line", async () => {
    const status = await new GetBookWaitlistStatus(waitlist(null).repo, loans).execute("b1", "g1");
    expect(status).toMatchObject({ onLoan: 2, queueLength: 2, position: 2 });
    expect(status.entry?.id).toBe("w1");
  });

  it("has no place for a guest who isn't in line, or nobody signed in", async () => {
    const { repo } = waitlist(null);
    expect(await new GetBookWaitlistStatus(repo, loans).execute("b1", "stranger")).toMatchObject({
      entry: null,
      position: null,
      queueLength: 2,
    });
    expect(await new GetBookWaitlistStatus(repo, loans).execute("b1")).toMatchObject({ entry: null, position: null });
  });
});

describe("waitlist lists", () => {
  it("delegate the guest's and the dashboard's views", async () => {
    const { repo } = waitlist(null);
    expect(await new ListOwnBookWaitlist(repo).execute("g1")).toHaveLength(1);
    expect(repo.listForUser).toHaveBeenCalledWith("g1");
    expect(await new ListBookWaitlist(repo).execute()).toHaveLength(2);
  });
});
