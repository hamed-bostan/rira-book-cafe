import { describe, expect, it, vi } from "vitest";

import { NotFoundError } from "../../../errors/NotFoundError";
import { ValidationError } from "../../../errors/ValidationError";
import { RefundBookingPayment } from "../RefundBookingPayment";

import type { CafeEvent, EventRegistration } from "../../../entities/CafeEvent";
import type { IncomeRefund, RefundablePayment } from "../../../entities/IncomeRefund";
import type { SuiteBooking } from "../../../entities/SuiteBooking";
import type { IIncomeRepository } from "../../../repositories/IIncomeRepository";

const ACTOR = { id: "owner", name: "Rira" };
/** 13:30 in Tehran on 2026-11-07. */
const NOW = new Date("2026-11-07T10:00:00Z");

const STAY = { id: "s1", reference: 12, guestName: "Neda", guestPhone: "+98 912 000 0000" } as SuiteBooking;
const EVENT = { id: "e1", title: "Poetry night" } as CafeEvent;
const SIGN_UP = { id: "g1", eventId: "e1", guestName: "Omid", guestPhone: "09121111111" } as EventRegistration;

const PAYMENT: RefundablePayment = {
  id: "p1",
  number: 14,
  accountCode: "4500",
  amount: 2_200_000,
  vatAmount: 200_000,
  createdAt: "2026-11-01T10:00:00.000Z",
  refunded: 0,
  refundedVat: 0,
};

function setup(payments: RefundablePayment[] = [PAYMENT]) {
  // The fake repository runs the plan against the payments, as the real one does under its lock.
  const refund = vi.fn<IIncomeRepository["refund"]>(async (input, plan) =>
    plan(payments).map((portion, index): IncomeRefund => ({
      ...input,
      id: `f${index + 1}`,
      number: index + 1,
      incomeId: portion.payment.id,
      incomeNumber: portion.payment.number,
      accountCode: portion.payment.accountCode,
      amount: portion.amount,
      vatAmount: portion.vatAmount,
      createdAt: "",
    })),
  );
  const notify = vi.fn(async () => {});
  const useCase = new RefundBookingPayment(
    { refund },
    { getById: vi.fn(async (id: string) => (id === STAY.id ? STAY : null)) },
    {
      getById: vi.fn(async (id: string) => (id === EVENT.id ? EVENT : null)),
      getRegistration: vi.fn(async (id: string) => (id === SIGN_UP.id ? SIGN_UP : null)),
    },
    { notify },
  );
  return { useCase, refund, notify };
}

describe("RefundBookingPayment", () => {
  it("hands back part of a stay's payment, against its revenue and VAT, and tells the guest by phone", async () => {
    const { useCase, refund, notify } = setup();
    const refunds = await useCase.execute(
      { sourceType: "suiteBooking", sourceId: "s1" },
      { amount: 1_100_000, method: "card", reason: "  shortened stay " },
      ACTOR,
      NOW,
    );

    expect(refund.mock.calls[0][0]).toEqual({
      sourceType: "suiteBooking",
      sourceId: "s1",
      date: "2026-11-07",
      method: "card",
      reason: "shortened stay",
      createdById: "owner",
      createdByName: "Rira",
    });
    expect(refunds).toHaveLength(1);
    expect(refunds[0]).toMatchObject({ amount: 1_100_000, vatAmount: 100_000 });

    const [, , ledger, audit] = refund.mock.calls[0];
    expect(ledger(refunds[0], { vatRateBps: 1000, serviceChargeBps: 0 })[0]?.lines).toEqual([
      { accountCode: "4500", debit: 1_000_000, credit: 0, memo: undefined },
      { accountCode: "2200", debit: 100_000, credit: 0 },
      { accountCode: "1120", debit: 0, credit: 1_100_000 },
    ]);
    expect(audit?.(refunds[0])).toMatchObject({ action: "income.refunded", entityId: "p1", entityLabel: "IN-14" });

    expect(notify).toHaveBeenCalledWith({
      userId: "09120000000",
      kind: "refundIssued",
      params: { amount: 1_100_000, subject: "suite", reference: 12 },
      link: "/suite",
      dedupeKey: "refund:f1",
    });
  });

  it("refunds an event sign-up, naming the event", async () => {
    const { useCase, notify } = setup([{ ...PAYMENT, accountCode: "4400" }]);
    await useCase.execute(
      { sourceType: "eventRegistration", sourceId: "g1", eventId: "e1" },
      { amount: 500_000, method: "cash" },
      ACTOR,
      NOW,
    );

    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "09121111111",
        params: { amount: 500_000, subject: "event", title: "Poetry night" },
        link: "/events/e1",
      }),
    );
  });

  it("refuses more than was paid and not yet refunded", async () => {
    const { useCase, notify } = setup([{ ...PAYMENT, refunded: 2_000_000, refundedVat: 181_818 }]);

    await expect(
      useCase.execute({ sourceType: "suiteBooking", sourceId: "s1" }, { amount: 200_001, method: "cash" }, ACTOR, NOW),
    ).rejects.toThrow(new ValidationError("amount", "refundOverPaid"));
    expect(notify).not.toHaveBeenCalled();
  });

  it("refuses a booking that isn't there, or a sign-up for another event", async () => {
    const { useCase } = setup();

    await expect(
      useCase.execute({ sourceType: "suiteBooking", sourceId: "nope" }, { amount: 1, method: "cash" }, ACTOR, NOW),
    ).rejects.toThrow(NotFoundError);
    await expect(
      useCase.execute(
        { sourceType: "eventRegistration", sourceId: "g1", eventId: "other" },
        { amount: 1, method: "cash" },
        ACTOR,
        NOW,
      ),
    ).rejects.toThrow(NotFoundError);
  });

  it("refuses an amount that isn't a positive whole number", async () => {
    const { useCase } = setup();

    await expect(
      useCase.execute({ sourceType: "suiteBooking", sourceId: "s1" }, { amount: 0, method: "cash" }, ACTOR, NOW),
    ).rejects.toThrow(ValidationError);
  });
});
