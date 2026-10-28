import type { BookLoan } from "../../entities/BookLoan";
import type {
  BookLoanCounts,
  BookLoanFilters,
  IBookLoanRepository,
  LendableBook,
} from "../../repositories/IBookLoanRepository";

/** The loan book for the dashboard. A cross-guest read: gate to staff. */
export class ListBookLoans {
  constructor(private readonly loanRepo: IBookLoanRepository) {}

  execute(filters: BookLoanFilters, now: Date): Promise<BookLoan[]> {
    return this.loanRepo.list({ view: filters.view, q: filters.q?.trim() || undefined }, now);
  }
}

/**
 * How many loans each tab of the loan book holds, whatever is being searched —
 * so the counts stay put while the list narrows. A cross-guest read: gate to staff.
 */
export class CountBookLoans {
  constructor(private readonly loanRepo: Pick<IBookLoanRepository, "countByView">) {}

  execute(now: Date): Promise<BookLoanCounts> {
    return this.loanRepo.countByView(now);
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
