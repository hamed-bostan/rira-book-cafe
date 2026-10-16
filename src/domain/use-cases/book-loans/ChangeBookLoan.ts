import { canTransitionBookLoan, type BookLoan, type BookLoanStatus } from "../../entities/BookLoan";
import { ConflictError } from "../../errors/ConflictError";
import { NotFoundError } from "../../errors/NotFoundError";

import type { ActivityActor } from "../../entities/ActivityEntry";
import type { IBookLoanRepository } from "../../repositories/IBookLoanRepository";

/** Staff close a loan: the book came back, or it's written off as lost. */
export class ChangeBookLoan {
  constructor(private readonly loanRepo: IBookLoanRepository) {}

  async execute(id: string, status: BookLoanStatus, staff: ActivityActor, now: Date): Promise<BookLoan> {
    const current = await this.loanRepo.getById(id);
    if (!current) throw new NotFoundError("book loan", id);
    if (status === current.status) return current;
    if (!canTransitionBookLoan(current.status, status)) {
      throw new ConflictError("INVALID_TRANSITION", `A loan can't move from "${current.status}" to "${status}".`);
    }

    return this.loanRepo.applyStatus(id, current.status, status, now, (saved) => ({
      actorId: staff.id,
      actorName: staff.name,
      action: status === "lost" ? "bookLoan.lost" : "bookLoan.returned",
      entityType: "bookLoan",
      entityId: saved.id,
      entityLabel: `L-${saved.reference}`,
      changes: [{ field: "status", before: current.status, after: saved.status }],
    }));
  }
}
