import { describe, expect, it, vi } from "vitest";

import { ConflictError } from "../../../errors/ConflictError";
import { NotFoundError } from "../../../errors/NotFoundError";
import { BorrowBook, JoinBookWaitlist } from "../BookWaitlist";
import { ChangeBookLoan } from "../ChangeBookLoan";

import type { BookLoan } from "../../../entities/BookLoan";
import type { BookWaitlistEntry } from "../../../entities/BookWaitlist";
import type { IBookLoanRepository } from "../../../repositories/IBookLoanRepository";
import type { IBookWaitlistRepository } from "../../../repositories/IBookWaitlistRepository";
import type { ICustomerNotifier } from "../../../repositories/INotificationRepository";

const NOW = new Date("2026-10-20T10:00:00Z");
const GUEST = { id: "09121234567", name: "Sara", phone: "+98 912 123 4567" };

function entry(overrides: Partial<BookWaitlistEntry> = {}): BookWaitlistEntry {
  return {
    id: "w1",
    productId: "b1",
    bookTitle: "The Blind Owl",
    userId: "g2",
    guestName: "Reza",
    guestPhone: "09350000000",
    status: "notified",
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...overrides,
  };
}

describe("JoinBookWaitlist", () => {
  const book = { title: "The Blind Owl", copies: 1 };

  it("puts the guest in line for a book that's out, with their phone normalized", async () => {
    const join = vi.fn(async () => entry({ status: "waiting" }));
    const waitlist = { join, listOpenForBook: vi.fn(async () => []) } as unknown as IBookWaitlistRepository;
    const loans = { getBook: vi.fn(async () => book), countOpenForBook: vi.fn(async () => 1) };
    await new JoinBookWaitlist(waitlist, loans).execute("b1", GUEST);
    expect(join).toHaveBeenCalledWith({
      productId: "b1",
      bookTitle: "The Blind Owl",
      userId: GUEST.id,
      guestName: "Sara",
      guestPhone: "09121234567",
    });
  });

  it("has no line for a book that's on the shelf", async () => {
    const loans = { getBook: vi.fn(async () => book), countOpenForBook: vi.fn(async () => 0) };
    const waitlist = { listOpenForBook: vi.fn(async () => []) } as unknown as IBookWaitlistRepository;
    await expect(new JoinBookWaitlist(waitlist, loans).execute("b1", GUEST)).rejects.toMatchObject({
      code: "BOOK_ON_SHELF",
    });
    expect(ConflictError).toBeDefined();
  });
});

describe("BorrowBook", () => {
  const book = { title: "The Blind Owl", copies: 1 };
  // Borrowed at 13:30 in Tehran on 20 Oct: theirs to collect until the end of the 23rd.
  const held = entry({
    userId: GUEST.id,
    guestName: GUEST.name,
    guestPhone: GUEST.id,
    notifiedAt: NOW.toISOString(),
    pickupBy: "2026-10-23T20:29:59.999Z",
  });

  function setUp(borrow: IBookWaitlistRepository["borrow"]) {
    const repo = { borrow: vi.fn(borrow) };
    const loans = { getBook: vi.fn(async () => book) };
    const notifier: ICustomerNotifier = { notify: vi.fn(async () => undefined) };
    return { repo, loans, notifier };
  }

  it("holds a free copy for the guest under their account and normalized phone, and says to collect it", async () => {
    const { repo, loans, notifier } = setUp(async () => held);

    expect(await new BorrowBook(repo, loans, notifier).execute("b1", GUEST, NOW)).toBe(held);

    expect(repo.borrow).toHaveBeenCalledWith(
      {
        productId: "b1",
        bookTitle: "The Blind Owl",
        userId: GUEST.id,
        guestName: "Sara",
        guestPhone: "09121234567",
      },
      NOW,
    );
    // The "collect it by …" message, keyed as the jobs' reminder is.
    expect(notifier.notify).toHaveBeenCalledWith({
      userId: "09121234567",
      kind: "holdCollectBy",
      params: { title: "The Blind Owl", dueAt: "2026-10-23T20:29:59.999Z" },
      link: "/loans",
      dedupeKey: "waitlist:w1:holdCollectBy",
    });
  });

  it("refuses as the shelf does — every copy out or held, already in line, already lent — and tells nobody", async () => {
    for (const code of ["NO_FREE_COPY", "ALREADY_WAITING", "ALREADY_ON_LOAN"] as const) {
      const { repo, loans, notifier } = setUp(async () => {
        throw new ConflictError(code, code);
      });
      await expect(new BorrowBook(repo, loans, notifier).execute("b1", GUEST, NOW)).rejects.toMatchObject({ code });
      expect(notifier.notify).not.toHaveBeenCalled();
    }
  });

  it("is not found for something that isn't a book", async () => {
    const { repo, notifier } = setUp(async () => held);
    const loans = { getBook: vi.fn(async () => null) };
    await expect(new BorrowBook(repo, loans, notifier).execute("x", GUEST, NOW)).rejects.toThrow(NotFoundError);
    expect(repo.borrow).not.toHaveBeenCalled();
  });
});

describe("ChangeBookLoan and the waitlist", () => {
  const out = { id: "l1", reference: 3, productId: "b1", status: "out" } as BookLoan;

  it("tells the front of the line when a copy comes back", async () => {
    const loans = {
      getById: vi.fn(async () => out),
      applyStatus: vi.fn(async () => ({ ...out, status: "returned" as const })),
    } as unknown as IBookLoanRepository;
    const notifyNext = vi.fn(async () => entry());
    const notifier: ICustomerNotifier = { notify: vi.fn(async () => undefined) };
    await new ChangeBookLoan(loans, { notifyNext }, notifier).execute("l1", "returned", { id: "s1", name: "Ali" }, NOW);
    expect(notifyNext).toHaveBeenCalledWith("b1", NOW);
    expect(notifier.notify).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "g2", kind: "bookAvailable", params: { title: "The Blind Owl" } }),
    );
  });

  it("tells nobody when a book is written off", async () => {
    const loans = {
      getById: vi.fn(async () => out),
      applyStatus: vi.fn(async () => ({ ...out, status: "lost" as const })),
    } as unknown as IBookLoanRepository;
    const notifyNext = vi.fn(async () => entry());
    await new ChangeBookLoan(loans, { notifyNext }).execute("l1", "lost", { id: "s1", name: "Ali" }, NOW);
    expect(notifyNext).not.toHaveBeenCalled();
  });
});
