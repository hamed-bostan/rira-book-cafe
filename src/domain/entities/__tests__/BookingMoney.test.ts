import { describe, expect, it } from "vitest";

import { netPaid, planRefund, refundableOf, type IncomeRefund, type RefundablePayment } from "../IncomeRefund";
import { assertBalanced } from "../Ledger";
import { incomeRefundEntry, reservationDepositEntry, reservationDepositSettledEntry } from "../Postings";
import { canSettleReservationDeposit, canTakeReservationDeposit, type ReservationDeposit } from "../ReservationDeposit";
import { suiteStayMoney, suiteStayTotal } from "../SuitePricing";

import type { Reservation } from "../Reservation";
import type { SuiteBooking } from "../SuiteBooking";

const ACTOR = { id: "staff", name: "Sara" };

const sides = (entry: { lines: { accountCode: string; debit: number; credit: number }[] }) =>
  entry.lines.map((line) => [line.accountCode, line.debit, line.credit]);

describe("a table deposit", () => {
  const HELD: ReservationDeposit = { amount: 400_000, method: "card", state: "held" };
  const booking = { id: "r1", reference: 7, guestName: "Neda", status: "confirmed", deposit: HELD } as Reservation;

  it("is held as a liability, on the account a book's deposit uses", () => {
    const entry = reservationDepositEntry(booking, "2026-11-07", ACTOR);

    expect(sides(assertBalanced(entry ?? { lines: [] }))).toEqual([
      ["1120", 400_000, 0],
      ["2400", 0, 400_000],
    ]);
    expect(entry).toMatchObject({
      source: "reservationDeposit",
      sourceId: "r1",
      uniqueKey: "reservation:r1:deposit",
      description: "R-7 — deposit taken (card)",
    });
  });

  it("lands in the cash register when paid in cash", () => {
    const cash = { ...booking, deposit: { amount: 400_000, method: "cash", state: "held" } } as Reservation;

    expect(sides(reservationDepositEntry(cash, "2026-11-07", ACTOR) ?? { lines: [] })[0]).toEqual(["1110", 400_000, 0]);
  });

  it("goes back the way it came when returned", () => {
    const returned = { ...booking, status: "completed", deposit: { ...HELD, state: "returned" } };
    const entry = reservationDepositSettledEntry(returned, "2026-11-08", ACTOR);

    expect(sides(assertBalanced(entry ?? { lines: [] }))).toEqual([
      ["2400", 400_000, 0],
      ["1120", 0, 400_000],
    ]);
    expect(entry?.uniqueKey).toBe("reservation:r1:depositReturned");
  });

  it("becomes other income when kept", () => {
    const kept = { ...booking, status: "noShow", deposit: { ...HELD, state: "kept" } };
    const entry = reservationDepositSettledEntry(kept, "2026-11-08", ACTOR);

    expect(sides(assertBalanced(entry ?? { lines: [] }))).toEqual([
      ["2400", 400_000, 0],
      ["4900", 0, 400_000],
    ]);
    expect(entry?.uniqueKey).toBe("reservation:r1:depositKept");
  });

  it("posts nothing while held, or without a deposit", () => {
    expect(reservationDepositSettledEntry(booking, "2026-11-08", ACTOR)).toBeNull();
    expect(reservationDepositEntry({ ...booking, deposit: undefined }, "2026-11-08", ACTOR)).toBeNull();
  });

  it("is taken while the booking is on, and settled once it's over", () => {
    expect(canTakeReservationDeposit({ status: "requested" })).toBe(true);
    expect(canTakeReservationDeposit({ status: "seated" })).toBe(true);
    expect(canTakeReservationDeposit({ status: "completed" })).toBe(false);
    expect(canTakeReservationDeposit({ status: "noShow" })).toBe(false);
    expect(canTakeReservationDeposit(booking)).toBe(false);

    expect(canSettleReservationDeposit(booking)).toBe(false);
    for (const status of ["completed", "noShow", "cancelled"] as const) {
      expect(canSettleReservationDeposit({ ...booking, status })).toBe(true);
    }
    expect(canSettleReservationDeposit({ status: "completed", deposit: { ...HELD, state: "returned" } })).toBe(false);
  });
});

describe("a refund", () => {
  const payment = (over: Partial<RefundablePayment>): RefundablePayment => ({
    id: "p1",
    number: 1,
    accountCode: "4500",
    amount: 1_100_000,
    vatAmount: 100_000,
    createdAt: "2026-11-01T10:00:00.000Z",
    refunded: 0,
    refundedVat: 0,
    ...over,
  });

  it("is posted against the payment's revenue account, with its VAT, out of the refund's account", () => {
    const refund = {
      id: "f1",
      number: 3,
      incomeId: "p1",
      incomeNumber: 14,
      accountCode: "4500",
      amount: 550_000,
      vatAmount: 50_000,
      method: "transfer",
      date: "2026-11-07",
      payerName: "Neda",
    } as IncomeRefund;
    const entry = incomeRefundEntry(refund, ACTOR);

    expect(sides(assertBalanced(entry))).toEqual([
      ["4500", 500_000, 0],
      ["2200", 50_000, 0],
      ["1120", 0, 550_000],
    ]);
    expect(entry).toMatchObject({ source: "incomeRefund", sourceId: "p1", uniqueKey: "incomeRefund:f1" });
    expect(entry.description).toBe("IN-14 — refund RF-3 (transfer)");
  });

  it("drops the VAT line when the payment carried none", () => {
    const refund = { id: "f2", number: 4, incomeId: "p1", incomeNumber: 15, accountCode: "4400" } as IncomeRefund;
    const entry = incomeRefundEntry(
      { ...refund, amount: 300_000, vatAmount: 0, method: "cash", date: "2026-11-07" },
      ACTOR,
    );

    expect(sides(assertBalanced(entry))).toEqual([
      ["4400", 300_000, 0],
      ["1110", 0, 300_000],
    ]);
  });

  it("is drawn from the newest payment first, each up to what it has left", () => {
    const older = payment({ id: "old", number: 1, amount: 600_000, vatAmount: 0 });
    const newer = payment({
      id: "new",
      number: 2,
      amount: 400_000,
      vatAmount: 0,
      createdAt: "2026-11-02T10:00:00.000Z",
    });
    const plan = planRefund([older, newer], 700_000);

    expect(plan?.map((portion) => [portion.payment.id, portion.amount])).toEqual([
      ["new", 400_000],
      ["old", 300_000],
    ]);
  });

  it("hands back the VAT in proportion, exactly all of it once refunded in full", () => {
    const first = planRefund([payment({})], 333_333);
    expect(first?.[0]).toMatchObject({ amount: 333_333, vatAmount: 30_303 });

    const rest = planRefund([payment({ refunded: 333_333, refundedVat: 30_303 })], 766_667);
    expect(rest?.[0]).toMatchObject({ amount: 766_667, vatAmount: 69_697 });
    expect(30_303 + 69_697).toBe(100_000);
  });

  it("refuses more than was paid and not yet refunded", () => {
    const payments = [payment({ refunded: 1_000_000, refundedVat: 90_909 })];

    expect(refundableOf(payments)).toBe(100_000);
    expect(planRefund(payments, 100_001)).toBeNull();
    expect(planRefund(payments, 0)).toBeNull();
    expect(planRefund([], 1)).toBeNull();
    expect(planRefund(payments, 100_000)?.[0].amount).toBe(100_000);
  });

  it("leaves what was paid less what went back", () => {
    expect(netPaid({ paidAmount: 900_000, refundedAmount: 300_000 })).toBe(600_000);
    expect(netPaid({})).toBe(0);
  });
});

describe("a suite stay's total", () => {
  const stay = {
    checkIn: "2026-11-10",
    checkOut: "2026-11-13",
    nightlyRate: 2_500_000,
    status: "confirmed",
  } as SuiteBooking;

  it("is the nights times the stay's own rate", () => {
    expect(suiteStayTotal(stay)).toBe(7_500_000);
  });

  it("prices itself again when the dates move", () => {
    expect(suiteStayTotal({ ...stay, checkOut: "2026-11-11" })).toBe(2_500_000);
    expect(suiteStayTotal({ ...stay, checkIn: "2026-11-08" })).toBe(12_500_000);
  });

  it("is unknown for a stay from before the suite had a price", () => {
    expect(suiteStayTotal({ ...stay, nightlyRate: undefined })).toBeUndefined();
    expect(suiteStayMoney({ ...stay, nightlyRate: undefined, paidAmount: 100 }).balance).toBeUndefined();
  });

  it("leaves a balance of the total less what was paid and not handed back", () => {
    expect(suiteStayMoney({ ...stay, paidAmount: 5_000_000, refundedAmount: 1_000_000 })).toEqual({
      total: 7_500_000,
      paid: 5_000_000,
      refunded: 1_000_000,
      balance: 3_500_000,
    });
    expect(suiteStayMoney({ ...stay, paidAmount: 8_000_000 }).balance).toBe(-500_000);
  });

  it("owes nothing once it ended without the guest staying", () => {
    expect(suiteStayMoney({ ...stay, status: "cancelled", paidAmount: 2_000_000 }).balance).toBe(-2_000_000);
    expect(suiteStayMoney({ ...stay, status: "noShow" }).balance).toBe(0);
  });
});
