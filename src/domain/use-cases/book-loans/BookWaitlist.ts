import { isOpenWaitlistEntry, type BookWaitlistEntry, type BookWaitlistStatus } from "../../entities/BookWaitlist";
import { normalizePhone } from "../../entities/Phone";
import { type User } from "../../entities/User";
import { ConflictError } from "../../errors/ConflictError";
import { NotFoundError } from "../../errors/NotFoundError";

import type { IBookLoanRepository } from "../../repositories/IBookLoanRepository";
import type { IBookWaitlistRepository } from "../../repositories/IBookWaitlistRepository";

/**
 * A guest asks to be told when a book comes back. Only a book that's out on loan
 * has a line — one on the shelf is a question for the counter.
 */
export class JoinBookWaitlist {
  constructor(
    private readonly waitlistRepo: IBookWaitlistRepository,
    private readonly loanRepo: Pick<IBookLoanRepository, "getBook" | "countOpenForBook">,
  ) {}

  async execute(productId: string, guest: Pick<User, "id" | "name" | "phone">): Promise<BookWaitlistEntry> {
    const book = await this.loanRepo.getBook(productId);
    if (!book) throw new NotFoundError("book", productId);
    if ((await this.loanRepo.countOpenForBook(productId)) === 0) {
      throw new ConflictError("BOOK_ON_SHELF", "This book isn't out on loan — ask at the counter.");
    }
    return this.waitlistRepo.join({
      productId,
      bookTitle: book.title,
      userId: guest.id,
      guestName: guest.name,
      // Normalized like a loan's borrower phone, so lending to them matches the entry.
      guestPhone: normalizePhone(guest.phone),
    });
  }
}

/** A guest leaves the line. Someone else's entry reads as not found. */
export class LeaveBookWaitlist {
  constructor(private readonly waitlistRepo: IBookWaitlistRepository) {}

  async execute(id: string, guestId: string): Promise<BookWaitlistEntry> {
    const entry = await this.waitlistRepo.getById(id);
    if (entry?.userId !== guestId) throw new NotFoundError("waitlist entry", id);
    if (!isOpenWaitlistEntry(entry)) return entry;
    return (await this.waitlistRepo.cancel(id)) ?? entry;
  }
}

/** Staff take a guest off a line (they changed their mind at the counter, or never came). */
export class RemoveFromBookWaitlist {
  constructor(private readonly waitlistRepo: IBookWaitlistRepository) {}

  async execute(id: string): Promise<BookWaitlistEntry> {
    const entry = await this.waitlistRepo.getById(id);
    if (!entry) throw new NotFoundError("waitlist entry", id);
    if (!isOpenWaitlistEntry(entry)) {
      throw new ConflictError("INVALID_TRANSITION", "This guest is no longer in line.");
    }
    return (await this.waitlistRepo.cancel(id)) ?? entry;
  }
}

/** A book's line as the guest sees it — copies out, line length, and their place in it. */
export class GetBookWaitlistStatus {
  constructor(
    private readonly waitlistRepo: IBookWaitlistRepository,
    private readonly loanRepo: Pick<IBookLoanRepository, "countOpenForBook">,
  ) {}

  async execute(productId: string, guestId?: string): Promise<BookWaitlistStatus> {
    const [onLoan, line] = await Promise.all([
      this.loanRepo.countOpenForBook(productId),
      this.waitlistRepo.listOpenForBook(productId),
    ]);
    const index = guestId ? line.findIndex((entry) => entry.userId === guestId) : -1;
    return {
      onLoan,
      queueLength: line.length,
      entry: index >= 0 ? line[index] : null,
      position: index >= 0 ? index + 1 : null,
    };
  }
}

/** The guest's own places in line, newest first. */
export class ListOwnBookWaitlist {
  constructor(private readonly waitlistRepo: IBookWaitlistRepository) {}

  execute(guestId: string): Promise<BookWaitlistEntry[]> {
    return this.waitlistRepo.listForUser(guestId);
  }
}

/** Every open line, for the dashboard. */
export class ListBookWaitlist {
  constructor(private readonly waitlistRepo: IBookWaitlistRepository) {}

  execute(): Promise<BookWaitlistEntry[]> {
    return this.waitlistRepo.listOpen();
  }
}
