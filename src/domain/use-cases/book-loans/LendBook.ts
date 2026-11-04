import {
  DEFAULT_LOAN_DAYS,
  MAX_LOAN_DAYS,
  MAX_LOAN_NOTE_LENGTH,
  type BookLoan,
  type LoanDepositMethod,
} from "../../entities/BookLoan";
import { cafeDayOf, cafeDayRange, isCafeDay, shiftCafeDay } from "../../entities/CafeTime";
import { normalizePhone } from "../../entities/Phone";
import { loanDepositEntry } from "../../entities/Postings";
import { ConflictError } from "../../errors/ConflictError";
import { NotFoundError } from "../../errors/NotFoundError";
import { ValidationError } from "../../errors/ValidationError";
import { ResolveGuestProfile, type GuestFieldNames } from "../guest-profiles/ResolveGuestProfile";
import { loanStartedNotification } from "../notifications/guestNotifications";

import type { ActivityActor } from "../../entities/ActivityEntry";
import type { IBookLoanRepository } from "../../repositories/IBookLoanRepository";
import type { IBookWaitlistRepository } from "../../repositories/IBookWaitlistRepository";
import type { ICustomerNotifier } from "../../repositories/INotificationRepository";
import type { IUserRepository } from "../../repositories/IUserRepository";

export type LendBookInput = {
  productId: string;
  /** The guest's phone, which finds their profile. */
  borrowerPhone: string;
  /** Needed only for a phone with no profile yet: the profile is made with the loan. */
  borrowerName?: string;
  /** Cafe day the book is due back (`YYYY-MM-DD`); omit for {@link DEFAULT_LOAN_DAYS}. */
  dueOn?: string;
  note?: string;
  /** Money left against the book, in Toman; 0 or omitted when none was taken. */
  depositAmount?: number;
  /** Required with a deposit: where it was paid into. */
  depositMethod?: LoanDepositMethod;
};

/** The loan form's names for the guest's two fields, so a refusal lands on the right one. */
const BORROWER_FIELDS: GuestFieldNames = { phone: "borrowerPhone", name: "borrowerName" };

/** How a book goes out, whoever takes it: when it's due back, a note, and a deposit if one was taken. */
export type LoanTerms = Pick<LendBookInput, "dueOn" | "note" | "depositAmount" | "depositMethod">;

/**
 * Staff hand a book to a guest, on the profile their phone finds — or on one made
 * with the loan, from their name, when the phone has none (`ResolveGuestProfile`);
 * a refused loan leaves no profile behind. The guest sees it on their loans page
 * and is told about it in their messages (`loanStartedNotification`). Lending the
 * book to someone in its waitlist takes them out of the line; lending a copy held
 * for a guest who was told it's back skips that guest, as staff would, and logs it.
 * A deposit goes on the books as money held for the borrower, not as income.
 */
export class LendBook {
  constructor(
    private readonly loanRepo: IBookLoanRepository,
    private readonly userRepo: Pick<IUserRepository, "getById">,
    private readonly notifier?: ICustomerNotifier,
  ) {}

  async execute(input: LendBookInput, staff: ActivityActor, now: Date): Promise<BookLoan> {
    const today = cafeDayOf(now);
    const dueOn = input.dueOn ?? shiftCafeDay(today, DEFAULT_LOAN_DAYS);
    if (!isCafeDay(dueOn)) throw new ValidationError("dueOn", "Choose a valid due date.");
    if (dueOn < today) throw new ValidationError("dueOn", "The due date can't be in the past.");
    if (dueOn > shiftCafeDay(today, MAX_LOAN_DAYS)) {
      throw new ValidationError("dueOn", `A loan can run at most ${MAX_LOAN_DAYS} days.`);
    }

    const note = input.note?.trim() || undefined;
    if (note && note.length > MAX_LOAN_NOTE_LENGTH) throw new ValidationError("note", "That note is too long.");

    const depositAmount = input.depositAmount ?? 0;
    if (!Number.isSafeInteger(depositAmount) || depositAmount < 0) {
      throw new ValidationError("depositAmount", "Enter the deposit in whole Toman.");
    }
    if (depositAmount > 0 && !input.depositMethod) {
      throw new ValidationError("depositMethod", "Choose how the deposit was paid.");
    }

    const book = await this.loanRepo.getBook(input.productId);
    if (!book) throw new ValidationError("productId", "Choose a book from the shelf.");

    const guest = await new ResolveGuestProfile(this.userRepo).execute(
      { phone: input.borrowerPhone, name: input.borrowerName },
      staff,
      BORROWER_FIELDS,
    );

    const loan = await this.loanRepo.create(
      {
        productId: input.productId,
        bookTitle: book.title,
        bookAuthor: book.author,
        userId: guest.userId,
        newGuest: guest.newProfile,
        borrowerName: guest.name,
        // Normalized, so a hold by the same phone is matched and fulfilled.
        borrowerPhone: normalizePhone(guest.phone),
        lentAt: now.toISOString(),
        // Due by closing time: the last instant of the due day on the cafe's clock.
        dueAt: new Date(cafeDayRange(dueOn).to.getTime() - 1).toISOString(),
        note,
        depositAmount,
        depositMethod: depositAmount > 0 ? input.depositMethod : undefined,
        lentById: staff.id,
        lentByName: staff.name,
      },
      (saved) => ({
        actorId: staff.id,
        actorName: staff.name,
        action: "bookLoan.lent",
        entityType: "bookLoan",
        entityId: saved.id,
        entityLabel: `L-${saved.reference}`,
        changes: [],
      }),
      (saved) => {
        const entry = loanDepositEntry(saved, today, staff);
        return entry ? [entry] : [];
      },
      (skipped) => ({
        actorId: staff.id,
        actorName: staff.name,
        action: "bookLoan.holdSkipped",
        entityType: "bookLoan",
        entityId: skipped.id,
        entityLabel: `${skipped.guestName} (${skipped.bookTitle})`,
        changes: [{ field: "status", before: "notified", after: skipped.status }],
      }),
    );

    const notification = loanStartedNotification(loan);
    if (notification && this.notifier) await this.notifier.notify(notification);
    return loan;
  }
}

/**
 * Staff hand a told guest the book held for them ("Lend now" on Book holds) — one
 * told it's back, or who borrowed it from the site. The loan is the hold's guest's
 * (their name, and their phone, so their profile), on the terms staff pick, and
 * goes out exactly as {@link LendBook} lends: logged, any deposit booked as money
 * held, and the hold fulfilled. Refused (`HOLD_NOT_READY`) once the hold is no
 * longer theirs to collect — lent, skipped, left or run out of time meanwhile.
 */
export class LendHeldBook {
  constructor(
    private readonly waitlistRepo: Pick<IBookWaitlistRepository, "getById">,
    private readonly lendBook: Pick<LendBook, "execute">,
  ) {}

  async execute(holdId: string, terms: LoanTerms, staff: ActivityActor, now: Date): Promise<BookLoan> {
    const hold = await this.waitlistRepo.getById(holdId);
    if (!hold) throw new NotFoundError("waitlist entry", holdId);
    if (hold.status !== "notified") {
      throw new ConflictError("HOLD_NOT_READY", "This book isn't held for this guest any more.");
    }
    return this.lendBook.execute(
      { ...terms, productId: hold.productId, borrowerName: hold.guestName, borrowerPhone: hold.guestPhone },
      staff,
      now,
    );
  }
}
