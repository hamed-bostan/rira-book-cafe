import { describe, expect, it, vi } from "vitest";

import { ConflictError } from "../../../errors/ConflictError";
import { JoinBookWaitlist } from "../BookWaitlist";
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
