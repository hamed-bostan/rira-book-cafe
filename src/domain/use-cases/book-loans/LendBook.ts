import {
  DEFAULT_LOAN_DAYS,
  MAX_BORROWER_NAME_LENGTH,
  MAX_LOAN_DAYS,
  MAX_LOAN_NOTE_LENGTH,
  type BookLoan,
} from "../../entities/BookLoan";
import { cafeDayOf, cafeDayRange, isCafeDay, shiftCafeDay } from "../../entities/CafeTime";
import { isPlausiblePhone, normalizePhone } from "../../entities/Phone";
import { ValidationError } from "../../errors/ValidationError";

import type { ActivityActor } from "../../entities/ActivityEntry";
import type { IBookLoanRepository } from "../../repositories/IBookLoanRepository";
import type { IUserRepository } from "../../repositories/IUserRepository";

export type LendBookInput = {
  productId: string;
  borrowerName: string;
  borrowerPhone: string;
  /** Cafe day the book is due back (`YYYY-MM-DD`); omit for {@link DEFAULT_LOAN_DAYS}. */
  dueOn?: string;
  note?: string;
};

/**
 * Staff hand a book to a guest. The borrower is whoever is at the counter — they
 * needn't have an account — but when their phone matches one, the loan is linked
 * so the guest sees it on their account page.
 */
export class LendBook {
  constructor(
    private readonly loanRepo: IBookLoanRepository,
    private readonly userRepo: Pick<IUserRepository, "getById">,
  ) {}

  async execute(input: LendBookInput, staff: ActivityActor, now: Date): Promise<BookLoan> {
    const borrowerName = input.borrowerName.trim();
    if (!borrowerName) throw new ValidationError("borrowerName", "Enter the borrower's name.");
    if (borrowerName.length > MAX_BORROWER_NAME_LENGTH) throw new ValidationError("borrowerName", "That name is too long.");
    if (!isPlausiblePhone(input.borrowerPhone)) throw new ValidationError("borrowerPhone", "Enter a valid phone number.");
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

    const book = await this.loanRepo.getBook(input.productId);
    if (!book) throw new ValidationError("productId", "Choose a book from the shelf.");

    // A user's id is their normalized phone, so this is the account lookup.
    const account = await this.userRepo.getById(borrowerPhone);

    return this.loanRepo.create(
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
    );
  }
}
