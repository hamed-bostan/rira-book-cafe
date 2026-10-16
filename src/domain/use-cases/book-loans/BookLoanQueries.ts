import type { BookLoan } from "../../entities/BookLoan";
import type { BookLoanFilters, IBookLoanRepository, LendableBook } from "../../repositories/IBookLoanRepository";

/** The loan book for the dashboard. A cross-guest read: gate to staff. */
export class ListBookLoans {
  constructor(private readonly loanRepo: IBookLoanRepository) {}

  execute(filters: BookLoanFilters, now: Date): Promise<BookLoan[]> {
    return this.loanRepo.list({ view: filters.view, q: filters.q?.trim() || undefined }, now);
  }
}

/** The guest's own loans. */
export class ListOwnBookLoans {
  constructor(private readonly loanRepo: IBookLoanRepository) {}

  execute(userId: string): Promise<BookLoan[]> {
    return this.loanRepo.listForUser(userId);
  }
}

/** The books staff can pick from when lending. */
export class ListLendableBooks {
  constructor(private readonly loanRepo: IBookLoanRepository) {}

  execute(): Promise<LendableBook[]> {
    return this.loanRepo.listLendableBooks();
  }
}
