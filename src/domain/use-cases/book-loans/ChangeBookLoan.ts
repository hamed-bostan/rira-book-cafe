import { MAX_LOAN_DAYS, canTransitionBookLoan, type BookLoan, type BookLoanStatus } from "../../entities/BookLoan";
import { cafeDayOf, cafeDayRange, shiftCafeDay } from "../../entities/CafeTime";
import { ConflictError } from "../../errors/ConflictError";
import { NotFoundError } from "../../errors/NotFoundError";
import { ValidationError } from "../../errors/ValidationError";

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
      // A counter hold has no account to tell — staff ring them.
      if (next?.userId && this.notifier) {
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

/**
 * Staff give a borrower more time: the due day moves `days` on from the later of
 * today and the current due day (an overdue book gets `days` from today), capped
 * at `MAX_LOAN_DAYS` from today.
 */
export class ExtendBookLoan {
  constructor(private readonly loanRepo: IBookLoanRepository) {}

  async execute(id: string, days: number, staff: ActivityActor, now: Date): Promise<BookLoan> {
    if (!Number.isInteger(days) || days < 1 || days > MAX_LOAN_DAYS) {
      throw new ValidationError("extendDays", `Extend by 1–${MAX_LOAN_DAYS} days.`);
    }
    const current = await this.loanRepo.getById(id);
    if (!current) throw new NotFoundError("book loan", id);
    if (current.status !== "out") {
      throw new ConflictError("INVALID_TRANSITION", "Only a book that's still out can be extended.");
    }

    const today = cafeDayOf(now);
    const dueDay = cafeDayOf(new Date(current.dueAt));
    const from = dueDay > today ? dueDay : today;
    const latest = shiftCafeDay(today, MAX_LOAN_DAYS);
    const nextDay = shiftCafeDay(from, days) > latest ? latest : shiftCafeDay(from, days);
    // Due by closing time: the last instant of the due day on the cafe's clock.
    const dueAt = new Date(cafeDayRange(nextDay).to.getTime() - 1).toISOString();

    return this.loanRepo.extend(id, dueAt, (saved) => ({
      actorId: staff.id,
      actorName: staff.name,
      action: "bookLoan.extended",
      entityType: "bookLoan",
      entityId: saved.id,
      entityLabel: `L-${saved.reference}`,
      changes: [{ field: "dueAt", before: current.dueAt, after: saved.dueAt }],
    }));
  }
}
