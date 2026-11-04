import { describe, expect, it, vi } from "vitest";

import { ConflictError } from "../../../errors/ConflictError";
import { NotFoundError } from "../../../errors/NotFoundError";
import { ValidationError } from "../../../errors/ValidationError";
import { SettleReservationDeposit, TakeReservationDeposit } from "../ReservationDeposit";

import type { Reservation } from "../../../entities/Reservation";
import type { IReservationDepositRepository } from "../../../repositories/IReservationDepositRepository";

const ACTOR = { id: "staff", name: "Sara" };
/** 13:30 in Tehran on 2026-11-07. */
const NOW = new Date("2026-11-07T10:00:00Z");

function reservation(overrides: Partial<Reservation> = {}): Reservation {
  return {
    id: "r1",
    reference: 7,
    guestName: "Neda",
    guestPhone: "09120000000",
    partySize: 6,
    startsAt: "2026-11-07T15:00:00.000Z",
    durationMinutes: 90,
    status: "confirmed",
    createdAt: "",
    updatedAt: "",
    ...overrides,
  };
}

function setup(current: Reservation | null) {
  const takeDeposit = vi.fn<IReservationDepositRepository["takeDeposit"]>(async (_id, deposit) =>
    reservation({ deposit: { ...deposit, state: "held" } }),
  );
  const settleDeposit = vi.fn<IReservationDepositRepository["settleDeposit"]>(async (_id, to) =>
    reservation({ status: "noShow", deposit: { amount: 400_000, method: "cash", state: to } }),
  );
  const reservations = { getById: vi.fn(async () => current) };
  return { reservations, deposits: { takeDeposit, settleDeposit }, takeDeposit, settleDeposit };
}

describe("TakeReservationDeposit", () => {
  it("holds it on Deposits held, dated today, and logs who took it", async () => {
    const { reservations, deposits, takeDeposit } = setup(reservation());
    const saved = await new TakeReservationDeposit(reservations, deposits).execute(
      "r1",
      { amount: 400_000, method: "cash" },
      ACTOR,
      NOW,
    );

    expect(takeDeposit.mock.calls[0][1]).toEqual({ amount: 400_000, method: "cash" });
    const [, , ledger, audit] = takeDeposit.mock.calls[0];
    expect(ledger(saved, { vatRateBps: 1000, serviceChargeBps: 0 })).toEqual([
      expect.objectContaining({
        date: "2026-11-07",
        source: "reservationDeposit",
        lines: [
          { accountCode: "1110", debit: 400_000, credit: 0 },
          { accountCode: "2400", debit: 0, credit: 400_000, memo: "Neda" },
        ],
      }),
    ]);
    expect(audit?.(saved)).toMatchObject({
      action: "reservation.depositTaken",
      entityType: "reservation",
      entityLabel: "R-7",
      changes: [
        { field: "deposit", before: null, after: "400000" },
        { field: "paymentMethod", before: null, after: "cash" },
      ],
    });
  });

  it("refuses a booking that's over, one that already has a deposit, and a missing booking", async () => {
    const run = (current: Reservation | null) => {
      const { reservations, deposits } = setup(current);
      return new TakeReservationDeposit(reservations, deposits).execute(
        "r1",
        { amount: 400_000, method: "card" },
        ACTOR,
        NOW,
      );
    };

    await expect(run(reservation({ status: "completed" }))).rejects.toThrow(ConflictError);
    await expect(run(reservation({ deposit: { amount: 100_000, method: "cash", state: "returned" } }))).rejects.toThrow(
      ConflictError,
    );
    await expect(run(null)).rejects.toThrow(NotFoundError);
  });

  it("refuses an amount that isn't a positive whole number", async () => {
    const { reservations, deposits } = setup(reservation());
    const useCase = new TakeReservationDeposit(reservations, deposits);

    await expect(useCase.execute("r1", { amount: 0, method: "cash" }, ACTOR, NOW)).rejects.toThrow(ValidationError);
    await expect(useCase.execute("r1", { amount: 1.5, method: "cash" }, ACTOR, NOW)).rejects.toThrow(ValidationError);
  });
});

describe("SettleReservationDeposit", () => {
  const held = { amount: 400_000, method: "cash" as const, state: "held" as const };

  it("keeps a no-show's deposit as other income", async () => {
    const { reservations, deposits, settleDeposit } = setup(reservation({ status: "noShow", deposit: held }));
    const saved = await new SettleReservationDeposit(reservations, deposits).execute("r1", "kept", ACTOR, NOW);

    const [, to, ledger, audit] = settleDeposit.mock.calls[0];
    expect(to).toBe("kept");
    expect(ledger(saved, { vatRateBps: 1000, serviceChargeBps: 0 })[0]?.lines).toEqual([
      { accountCode: "2400", debit: 400_000, credit: 0, memo: "Neda" },
      { accountCode: "4900", debit: 0, credit: 400_000 },
    ]);
    expect(audit?.(saved)).toMatchObject({
      action: "reservation.depositKept",
      changes: [{ field: "depositState", before: "held", after: "kept" }],
    });
  });

  it("hands it back once the booking is over", async () => {
    const { reservations, deposits, settleDeposit } = setup(reservation({ status: "completed", deposit: held }));
    await new SettleReservationDeposit(reservations, deposits).execute("r1", "returned", ACTOR, NOW);

    expect(settleDeposit.mock.calls[0][1]).toBe("returned");
  });

  it("refuses while the booking is still on, or with nothing held", async () => {
    const run = (current: Reservation) => {
      const { reservations, deposits } = setup(current);
      return new SettleReservationDeposit(reservations, deposits).execute("r1", "returned", ACTOR, NOW);
    };

    await expect(run(reservation({ status: "seated", deposit: held }))).rejects.toThrow(ConflictError);
    await expect(run(reservation({ status: "completed" }))).rejects.toThrow(ConflictError);
    await expect(run(reservation({ status: "completed", deposit: { ...held, state: "kept" } }))).rejects.toThrow(
      ConflictError,
    );
  });
});
