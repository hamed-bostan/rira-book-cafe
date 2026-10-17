import { canTransitionBookLoan, type BookLoan, type BookLoanStatus } from "../../entities/BookLoan";
import { ConflictError } from "../../errors/ConflictError";
import { NotFoundError } from "../../errors/NotFoundError";

import type { ActivityActor } from "../../entities/ActivityEntry";
import type { IBookLoanRepository } from "../../repositories/IBookLoanRepository";
import type { IBookWaitlistRepository } from "../../repositories/IBookWaitlistRepository";
import type { ICustomerNotifier } from "../../repositories/INotificationRepository";

/**
 * Staff close a loan: the book came back, or it's written off as lost. A book
 * coming back tells the guest at the front of its waitlist.
 */
export class ChangeBookLoan {
  constructor(
    private readonly loanRepo: IBookLoanRepository,
    private readonly waitlistRepo?: Pick<IBookWaitlistRepository, "notifyNext">,
    private readonly notifier?: ICustomerNotifier,
  ) {}

  async execute(id: string, status: BookLoanStatus, staff: ActivityActor, now: Date): Promise<BookLoan> {
    const current = await this.loanRepo.getById(id);
    if (!current) throw new NotFoundError("book loan", id);
    if (status === current.status) return current;
    if (!canTransitionBookLoan(current.status, status)) {
      throw new ConflictError("INVALID_TRANSITION", `A loan can't move from "${current.status}" to "${status}".`);
    }

    const saved = await this.loanRepo.applyStatus(id, current.status, status, now, (saved) => ({
      actorId: staff.id,
      actorName: staff.name,
      action: status === "lost" ? "bookLoan.lost" : "bookLoan.returned",
      entityType: "bookLoan",
      entityId: saved.id,
      entityLabel: `L-${saved.reference}`,
      changes: [{ field: "status", before: current.status, after: saved.status }],
    }));

    if (saved.status === "returned" && this.waitlistRepo) {
      const next = await this.waitlistRepo.notifyNext(saved.productId, now);
      if (next && this.notifier) {
        await this.notifier.notify({
          userId: next.userId,
          kind: "bookAvailable",
          params: { title: next.bookTitle },
          link: "/loans",
          dedupeKey: `waitlist:${next.id}:available`,
        });
      }
    }
    return saved;
  }
}
