import {
  DEFAULT_LOAN_DAYS,
  MAX_BORROWER_NAME_LENGTH,
  MAX_LOAN_DAYS,
  MAX_LOAN_NOTE_LENGTH,
  type BookLoan,
  type LoanDepositMethod,
} from "../../entities/BookLoan";
import { cafeDayOf, cafeDayRange, isCafeDay, shiftCafeDay } from "../../entities/CafeTime";
import { isPlausiblePhone, normalizePhone } from "../../entities/Phone";
import { loanDepositEntry } from "../../entities/Postings";
import { ValidationError } from "../../errors/ValidationError";
import { loanStartedNotification } from "../notifications/guestNotifications";

import type { ActivityActor } from "../../entities/ActivityEntry";
import type { IBookLoanRepository } from "../../repositories/IBookLoanRepository";
import type { ICustomerNotifier } from "../../repositories/INotificationRepository";
import type { IUserRepository } from "../../repositories/IUserRepository";

export type LendBookInput = {
  productId: string;
  borrowerName: string;
  borrowerPhone: string;
  /** Cafe day the book is due back (`YYYY-MM-DD`); omit for {@link DEFAULT_LOAN_DAYS}. */
  dueOn?: string;
  note?: string;
  /** Money left against the book, in Toman; 0 or omitted when none was taken. */
  depositAmount?: number;
  /** Required with a deposit: where it was paid into. */
  depositMethod?: LoanDepositMethod;
};

/**
 * Staff hand a book to a guest. The borrower is whoever is at the counter — they
 * needn't have an account — but when their phone matches one, the loan is linked
 * so the guest sees it on their account page. Either way they're told about it in
 * their messages, by their phone (`loanStartedNotification`). Lending the
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
    const borrowerName = input.borrowerName.trim();
    if (!borrowerName) throw new ValidationError("borrowerName", "Enter the borrower's name.");
    if (borrowerName.length > MAX_BORROWER_NAME_LENGTH)
      throw new ValidationError("borrowerName", "That name is too long.");
    if (!isPlausiblePhone(input.borrowerPhone))
      throw new ValidationError("borrowerPhone", "Enter a valid phone number.");
    const borrowerPhone = normalizePhone(input.borrowerPhone);

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

    // A user's id is their normalized phone, so this is the account lookup.
    const account = await this.userRepo.getById(borrowerPhone);

    const loan = await this.loanRepo.create(
      {
        productId: input.productId,
        bookTitle: book.title,
        bookAuthor: book.author,
        userId: account?.id,
        borrowerName,
        borrowerPhone,
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
