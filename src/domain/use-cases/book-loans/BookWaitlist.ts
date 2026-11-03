import { MAX_BORROWER_NAME_LENGTH } from "../../entities/BookLoan";
import {
  bookHasLine,
  isOpenWaitlistEntry,
  type BookWaitlistEntry,
  type BookWaitlistStatus,
} from "../../entities/BookWaitlist";
import { isPlausiblePhone, normalizePhone } from "../../entities/Phone";
import { type User } from "../../entities/User";
import { ConflictError } from "../../errors/ConflictError";
import { NotFoundError } from "../../errors/NotFoundError";
import { ValidationError } from "../../errors/ValidationError";
import { bookAvailableNotification } from "../notifications/guestNotifications";

import type { IBookLoanRepository } from "../../repositories/IBookLoanRepository";
import type { IBookWaitlistRepository } from "../../repositories/IBookWaitlistRepository";
import type { ICustomerNotifier } from "../../repositories/INotificationRepository";
import type { IUserRepository } from "../../repositories/IUserRepository";

/** How far back the dashboard's Closed tab reaches. */
export const CLOSED_HOLDS_LOOKBACK_DAYS = 60;

type BookLookup = Pick<IBookLoanRepository, "getBook" | "countOpenForBook">;

/** A book, its copies out, and its line — what deciding whether the line takes a guest reads. */
async function readLine(
  productId: string,
  loanRepo: BookLookup,
  waitlistRepo: Pick<IBookWaitlistRepository, "listOpenForBook">,
): Promise<{ book: { title: string; copies: number }; onLoan: number; line: BookWaitlistEntry[] }> {
  const book = await loanRepo.getBook(productId);
  if (!book) throw new NotFoundError("book", productId);
  const [onLoan, line] = await Promise.all([
    loanRepo.countOpenForBook(productId),
    waitlistRepo.listOpenForBook(productId),
  ]);
  return { book, onLoan, line };
}

/**
 * The book a guest wants to queue for, if it can have a line ({@link bookHasLine}):
 * a copy free on the shelf with nobody waiting is a question for the counter, not
 * a hold (`BOOK_ON_SHELF`).
 */
async function bookWithLine(
  productId: string,
  loanRepo: BookLookup,
  waitlistRepo: Pick<IBookWaitlistRepository, "listOpenForBook">,
): Promise<{ title: string }> {
  const { book, onLoan, line } = await readLine(productId, loanRepo, waitlistRepo);
  if (!bookHasLine(book.copies - onLoan, line.length)) {
    throw new ConflictError("BOOK_ON_SHELF", "This book is on the shelf — lend it instead.");
  }
  return book;
}

/** A guest asks to be told when a book comes back. */
export class JoinBookWaitlist {
  constructor(
    private readonly waitlistRepo: IBookWaitlistRepository,
    private readonly loanRepo: BookLookup,
  ) {}

  async execute(productId: string, guest: Pick<User, "id" | "name" | "phone">): Promise<BookWaitlistEntry> {
    const book = await bookWithLine(productId, this.loanRepo, this.waitlistRepo);
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

export type AddToBookWaitlistInput = {
  productId: string;
  guestName: string;
  guestPhone: string;
};

/**
 * Staff add a guest who asked at the counter or by phone to a book's line. They
 * needn't have an account — they're told when the book is back by their phone —
 * and when their phone matches one, the hold is linked so the guest sees it too.
 */
export class AddToBookWaitlist {
  constructor(
    private readonly waitlistRepo: IBookWaitlistRepository,
    private readonly loanRepo: BookLookup,
    private readonly userRepo: Pick<IUserRepository, "getById">,
  ) {}

  async execute(input: AddToBookWaitlistInput): Promise<BookWaitlistEntry> {
    const guestName = input.guestName.trim();
    if (!guestName) throw new ValidationError("guestName", "Enter the guest's name.");
    if (guestName.length > MAX_BORROWER_NAME_LENGTH) throw new ValidationError("guestName", "That name is too long.");
    if (!isPlausiblePhone(input.guestPhone)) throw new ValidationError("guestPhone", "Enter a valid phone number.");
    const guestPhone = normalizePhone(input.guestPhone);

    const book = await bookWithLine(input.productId, this.loanRepo, this.waitlistRepo);
    // A user's id is their normalized phone, so this is the account lookup.
    const account = await this.userRepo.getById(guestPhone);
    return this.waitlistRepo.join({
      productId: input.productId,
      bookTitle: book.title,
      userId: account?.id,
      guestName,
      guestPhone,
    });
  }
}

/**
 * A copy is free for the line: the guest at the front who hasn't been told yet is
 * told it's theirs, in their messages on the site — a counter or phone hold by its
 * phone, so they see it once they sign in with that number. `null` when nobody is
 * waiting.
 */
export async function tellNextInLine(
  productId: string,
  now: Date,
  waitlistRepo: Pick<IBookWaitlistRepository, "notifyNext">,
  notifier?: ICustomerNotifier,
): Promise<BookWaitlistEntry | null> {
  const next = await waitlistRepo.notifyNext(productId, now);
  const notification = next ? bookAvailableNotification(next) : null;
  if (notification && notifier) await notifier.notify(notification);
  return next;
}

/**
 * Take an entry out of line, however it leaves. A guest who'd been told passes
 * their copy on: the next guest in line is told it's theirs. Whether they'd been
 * told is read off the entry the cancel closed, so one told a moment before still
 * passes it on. `null` when it was no longer open.
 */
async function leaveLine(
  id: string,
  now: Date,
  waitlistRepo: Pick<IBookWaitlistRepository, "cancel" | "notifyNext">,
  notifier?: ICustomerNotifier,
): Promise<BookWaitlistEntry | null> {
  const removed = await waitlistRepo.cancel(id);
  if (removed?.notifiedAt) await tellNextInLine(removed.productId, now, waitlistRepo, notifier);
  return removed;
}

/**
 * A guest leaves the line from the site. Leaving after being told passes the copy
 * on, as staff skipping them would. Someone else's entry reads as not found.
 */
export class LeaveBookWaitlist {
  constructor(
    private readonly waitlistRepo: IBookWaitlistRepository,
    private readonly notifier?: ICustomerNotifier,
  ) {}

  async execute(id: string, guestId: string, now: Date = new Date()): Promise<BookWaitlistEntry> {
    const entry = await this.waitlistRepo.getById(id);
    if (entry?.userId !== guestId) throw new NotFoundError("waitlist entry", id);
    if (!isOpenWaitlistEntry(entry)) return entry;
    return (await leaveLine(id, now, this.waitlistRepo, this.notifier)) ?? entry;
  }
}

/**
 * Staff take a guest off a line: they changed their mind, or never came for a
 * book that was waiting for them ("Skip"). Skipping someone who'd been told passes
 * the copy on — the next guest in line is told it's theirs.
 */
export class RemoveFromBookWaitlist {
  constructor(
    private readonly waitlistRepo: IBookWaitlistRepository,
    private readonly notifier?: ICustomerNotifier,
  ) {}

  async execute(id: string, now: Date = new Date()): Promise<BookWaitlistEntry> {
    const entry = await this.waitlistRepo.getById(id);
    if (!entry) throw new NotFoundError("waitlist entry", id);
    if (!isOpenWaitlistEntry(entry)) {
      throw new ConflictError("INVALID_TRANSITION", "This guest is no longer in line.");
    }
    return (await leaveLine(id, now, this.waitlistRepo, this.notifier)) ?? entry;
  }
}

/**
 * A book's line as the guest sees it — copies out and on the shelf, line length,
 * whether it takes them, and their place in it. Not found for something that isn't
 * a book.
 */
export class GetBookWaitlistStatus {
  constructor(
    private readonly waitlistRepo: IBookWaitlistRepository,
    private readonly loanRepo: BookLookup,
  ) {}

  async execute(productId: string, guestId?: string): Promise<BookWaitlistStatus> {
    const { book, onLoan, line } = await readLine(productId, this.loanRepo, this.waitlistRepo);
    const free = book.copies - onLoan;
    const index = guestId ? line.findIndex((entry) => entry.userId === guestId) : -1;
    return {
      onLoan,
      onShelf: Math.max(free, 0),
      queueLength: line.length,
      canJoin: bookHasLine(free, line.length),
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

/** Holds that closed lately — borrowed or cancelled — for the dashboard's Closed tab. */
export class ListClosedBookWaitlist {
  constructor(private readonly waitlistRepo: IBookWaitlistRepository) {}

  execute(now: Date): Promise<BookWaitlistEntry[]> {
    return this.waitlistRepo.listClosedSince(
      new Date(now.getTime() - CLOSED_HOLDS_LOOKBACK_DAYS * 24 * 60 * 60 * 1000),
    );
  }
}
