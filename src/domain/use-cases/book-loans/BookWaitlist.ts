import {
  bookHasLine,
  isOpenWaitlistEntry,
  type BookWaitlistEntry,
  type BookWaitlistStatus,
} from "../../entities/BookWaitlist";
import { normalizePhone } from "../../entities/Phone";
import { type User } from "../../entities/User";
import { ConflictError } from "../../errors/ConflictError";
import { NotFoundError } from "../../errors/NotFoundError";
import { ResolveGuestProfile } from "../guest-profiles/ResolveGuestProfile";
import { bookAvailableNotification, dueHoldReminder } from "../notifications/guestNotifications";

import type { ActivityActor } from "../../entities/ActivityEntry";
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

/** The book's title, for the hold to keep; not found for something that isn't a book. */
async function bookTitle(productId: string, loanRepo: Pick<IBookLoanRepository, "getBook">): Promise<string> {
  const book = await loanRepo.getBook(productId);
  if (!book) throw new NotFoundError("book", productId);
  return book.title;
}

/**
 * A signed-in guest asks to be told when a book comes back. The repository takes
 * them only while the book has a line (`bookHasLine`) and they hold fewer books
 * than the cap (`canHoldAnother`), deciding under the book's lock.
 */
export class JoinBookWaitlist {
  constructor(
    private readonly waitlistRepo: Pick<IBookWaitlistRepository, "join">,
    private readonly loanRepo: Pick<IBookLoanRepository, "getBook">,
  ) {}

  async execute(productId: string, guest: Pick<User, "id" | "name" | "phone">): Promise<BookWaitlistEntry> {
    return this.waitlistRepo.join({
      productId,
      bookTitle: await bookTitle(productId, this.loanRepo),
      userId: guest.id,
      guestName: guest.name,
      // Normalized like a loan's borrower phone, so lending to them matches the entry.
      guestPhone: normalizePhone(guest.phone),
    });
  }
}

/**
 * A signed-in guest borrows a book from the site while a copy is free that nobody
 * holds or waits for. Their hold starts ready to collect — told now, with the
 * usual days to come for it — and holds that copy, as a told guest's is held:
 * lending it to anyone else skips them, and if they don't come the jobs pass it on.
 * Whether a copy is free, and whether they may hold another book, is decided under
 * the book's lending lock (`IBookWaitlistRepository.borrow`), so two guests can't
 * take the same copy. They get the "collect it by …" message straight away.
 */
export class BorrowBook {
  constructor(
    private readonly waitlistRepo: Pick<IBookWaitlistRepository, "borrow">,
    private readonly loanRepo: Pick<IBookLoanRepository, "getBook">,
    private readonly notifier?: ICustomerNotifier,
  ) {}

  async execute(
    productId: string,
    guest: Pick<User, "id" | "name" | "phone">,
    now: Date = new Date(),
  ): Promise<BookWaitlistEntry> {
    const entry = await this.waitlistRepo.borrow(
      {
        productId,
        bookTitle: await bookTitle(productId, this.loanRepo),
        userId: guest.id,
        guestName: guest.name,
        // Normalized like a loan's borrower phone, so lending to them matches the hold.
        guestPhone: normalizePhone(guest.phone),
      },
      now,
    );
    // Keyed like the jobs' reminder, so they don't send it again.
    const notification = dueHoldReminder(entry, now);
    if (notification && this.notifier) await this.notifier.notify(notification);
    return entry;
  }
}

export type AddToBookWaitlistInput = {
  productId: string;
  guestPhone: string;
  /** Needed only for a phone with no profile yet. */
  guestName?: string;
};

/**
 * Staff add a guest who asked at the counter or by phone to a book's line, on the
 * profile their phone finds — or on one made with the hold, from their name, when
 * the phone has none. The repository refuses it as it refuses a guest joining (no
 * line, already in it, at the cap), and a refused hold leaves no profile behind.
 */
export class AddToBookWaitlist {
  constructor(
    private readonly waitlistRepo: Pick<IBookWaitlistRepository, "join">,
    private readonly loanRepo: Pick<IBookLoanRepository, "getBook">,
    private readonly userRepo: Pick<IUserRepository, "getById">,
  ) {}

  async execute(input: AddToBookWaitlistInput, staff: ActivityActor): Promise<BookWaitlistEntry> {
    const title = await bookTitle(input.productId, this.loanRepo);
    const guest = await new ResolveGuestProfile(this.userRepo).execute(
      { phone: input.guestPhone, name: input.guestName },
      staff,
    );
    return this.waitlistRepo.join({
      productId: input.productId,
      bookTitle: title,
      userId: guest.userId,
      newGuest: guest.newProfile,
      guestName: guest.name,
      // Normalized like a loan's borrower phone, so lending to them matches the hold.
      guestPhone: normalizePhone(guest.phone),
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
  return passCopyOn(await waitlistRepo.cancel(id), now, waitlistRepo, notifier);
}

/**
 * After a hold closed — the guest left, was skipped, or didn't come in time — a
 * guest who'd been told passes their copy on: the next in line is told it's theirs.
 * Hands back the closed hold (`null` when nothing closed).
 */
export async function passCopyOn(
  closed: BookWaitlistEntry | null,
  now: Date,
  waitlistRepo: Pick<IBookWaitlistRepository, "notifyNext">,
  notifier?: ICustomerNotifier,
): Promise<BookWaitlistEntry | null> {
  if (closed?.notifiedAt) await tellNextInLine(closed.productId, now, waitlistRepo, notifier);
  return closed;
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
 * whether it takes them or a copy is theirs to borrow, and their place in it. Not
 * found for something that isn't a book.
 */
export class GetBookWaitlistStatus {
  constructor(
    private readonly waitlistRepo: IBookWaitlistRepository,
    private readonly loanRepo: BookLookup,
  ) {}

  async execute(productId: string, guestId?: string): Promise<BookWaitlistStatus> {
    const [{ book, onLoan, line }, guestHolds] = await Promise.all([
      readLine(productId, this.loanRepo, this.waitlistRepo),
      guestId ? this.waitlistRepo.countOpenForUser(guestId) : 0,
    ]);
    const free = book.copies - onLoan;
    const index = guestId ? line.findIndex((entry) => entry.userId === guestId) : -1;
    const hasLine = bookHasLine(free, line);
    return {
      onLoan,
      onShelf: Math.max(free, 0),
      queueLength: line.length,
      canJoin: hasLine,
      canBorrow: !hasLine,
      guestHolds,
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
