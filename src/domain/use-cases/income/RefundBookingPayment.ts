import { singleChange, type ActivityActor } from "../../entities/ActivityEntry";
import { cafeDayOf } from "../../entities/CafeTime";
import { MAX_REFUND_REASON_LENGTH, planRefund, type IncomeRefund } from "../../entities/IncomeRefund";
import { incomeRefundEntry } from "../../entities/Postings";
import { NotFoundError } from "../../errors/NotFoundError";
import { ValidationError } from "../../errors/ValidationError";
import { refundNotification, type RefundSubject } from "../notifications/guestNotifications";

import type { IncomeMethod } from "../../entities/Income";
import type { IEventRepository } from "../../repositories/IEventRepository";
import type { IIncomeRepository } from "../../repositories/IIncomeRepository";
import type { ICustomerNotifier } from "../../repositories/INotificationRepository";
import type { ISuiteBookingRepository } from "../../repositories/ISuiteBookingRepository";

/** What was paid for: a suite stay, or one sign-up for an event. */
export type RefundTarget =
  | { sourceType: "suiteBooking"; sourceId: string }
  | { sourceType: "eventRegistration"; sourceId: string; eventId: string };

export type RefundInput = {
  /** Whole Toman, VAT included. */
  amount: number;
  /** How it goes back — cash from the register, or a card or transfer refund from the bank. */
  method: IncomeMethod;
  reason?: string;
};

/**
 * Hand money back from what a guest paid for a suite stay or an event sign-up —
 * all of it or part, up to what's been paid and not yet handed back. The refund is
 * drawn from the booking's payments (newest first), each share booked against the
 * revenue account and VAT its payment went to, in one transaction with those
 * payments locked so two refunds can't both hand back the same money. The guest is
 * told, by their phone, whether or not they have an account yet.
 */
export class RefundBookingPayment {
  constructor(
    private readonly incomes: Pick<IIncomeRepository, "refund">,
    private readonly stays: Pick<ISuiteBookingRepository, "getById">,
    private readonly events: Pick<IEventRepository, "getById" | "getRegistration">,
    private readonly notifier?: ICustomerNotifier,
  ) {}

  async execute(
    target: RefundTarget,
    input: RefundInput,
    actor: ActivityActor,
    now: Date = new Date(),
  ): Promise<IncomeRefund[]> {
    if (!Number.isSafeInteger(input.amount) || input.amount <= 0) {
      throw new ValidationError("amount", "amountInvalid");
    }
    const reason = input.reason?.trim() || undefined;
    if (reason && reason.length > MAX_REFUND_REASON_LENGTH) throw new ValidationError("reason", "textTooLong");
    const { guestPhone, subject } = await this.whoPaid(target);

    const refunds = await this.incomes.refund(
      {
        sourceType: target.sourceType,
        sourceId: target.sourceId,
        date: cafeDayOf(now),
        method: input.method,
        reason,
        createdById: actor.id,
        createdByName: actor.name,
      },
      (payments) => {
        const plan = planRefund(payments, input.amount);
        if (!plan) throw new ValidationError("amount", "refundOverPaid");
        return plan;
      },
      (refund) => [incomeRefundEntry(refund, actor)],
      (refund) => ({
        actorId: actor.id,
        actorName: actor.name,
        action: "income.refunded",
        entityType: "income",
        entityId: refund.incomeId,
        entityLabel: `IN-${refund.incomeNumber}`,
        changes: [
          ...singleChange("refunded", null, refund.amount),
          ...singleChange("paymentMethod", null, refund.method),
        ],
      }),
    );

    if (this.notifier && refunds[0]) {
      await this.notifier.notify(refundNotification(guestPhone, subject, input.amount, refunds[0].id));
    }
    return refunds;
  }

  /** The booking behind the money: who paid, and what for. Not found reads as 404. */
  private async whoPaid(target: RefundTarget): Promise<{ guestPhone: string; subject: RefundSubject }> {
    if (target.sourceType === "suiteBooking") {
      const stay = await this.stays.getById(target.sourceId);
      if (!stay) throw new NotFoundError("suite booking", target.sourceId);
      return { guestPhone: stay.guestPhone, subject: { kind: "suite", reference: stay.reference } };
    }
    const [event, registration] = await Promise.all([
      this.events.getById(target.eventId),
      this.events.getRegistration(target.sourceId),
    ]);
    if (!event || registration?.eventId !== target.eventId) {
      throw new NotFoundError("registration", target.sourceId);
    }
    return { guestPhone: registration.guestPhone, subject: { kind: "event", eventId: event.id, title: event.title } };
  }
}
