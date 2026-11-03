import {
  singleChange,
  type ActivityActor,
  type ActivityChange,
  type NewActivityEntry,
} from "../../entities/ActivityEntry";
import { cafeDayOf } from "../../entities/CafeTime";
import { reservationDepositEntry, reservationDepositSettledEntry } from "../../entities/Postings";
import {
  canSettleReservationDeposit,
  canTakeReservationDeposit,
  type ReservationDepositMethod,
  type ReservationDepositSettlement,
} from "../../entities/ReservationDeposit";
import { ConflictError } from "../../errors/ConflictError";
import { NotFoundError } from "../../errors/NotFoundError";
import { ValidationError } from "../../errors/ValidationError";

import type { Reservation } from "../../entities/Reservation";
import type { IReservationDepositRepository } from "../../repositories/IReservationDepositRepository";
import type { IReservationRepository } from "../../repositories/IReservationRepository";

export type TakeReservationDepositInput = {
  /** Whole Toman. */
  amount: number;
  method: ReservationDepositMethod;
};

const SETTLE_ACTIONS = {
  returned: "reservation.depositReturned",
  kept: "reservation.depositKept",
} as const;

function audit(
  actor: ActivityActor,
  action: "reservation.depositTaken" | (typeof SETTLE_ACTIONS)[ReservationDepositSettlement],
  changes: (saved: Reservation) => ActivityChange[],
) {
  return (saved: Reservation): NewActivityEntry => ({
    actorId: actor.id,
    actorName: actor.name,
    action,
    entityType: "reservation",
    entityId: saved.id,
    entityLabel: `R-${saved.reference}`,
    changes: changes(saved),
  });
}

/**
 * Staff take a deposit on a table booking that's still on — at the counter, by
 * card or transfer, never online. The cafe holds it: Dr the money's account / Cr
 * Deposits held, in the same transaction as the booking row.
 */
export class TakeReservationDeposit {
  constructor(
    private readonly reservations: Pick<IReservationRepository, "getById">,
    private readonly deposits: IReservationDepositRepository,
  ) {}

  async execute(
    id: string,
    input: TakeReservationDepositInput,
    actor: ActivityActor,
    now: Date = new Date(),
  ): Promise<Reservation> {
    if (!Number.isSafeInteger(input.amount) || input.amount <= 0) {
      throw new ValidationError("amount", "Enter the deposit.");
    }
    const current = await this.reservations.getById(id);
    if (!current) throw new NotFoundError("reservation", id);
    if (!canTakeReservationDeposit(current)) {
      throw new ConflictError(
        "INVALID_TRANSITION",
        current.deposit ? "This booking already has a deposit." : "A deposit is taken before the party has left.",
      );
    }

    return this.deposits.takeDeposit(
      id,
      { amount: input.amount, method: input.method },
      (saved) => {
        const entry = reservationDepositEntry(saved, cafeDayOf(now), actor);
        return entry ? [entry] : [];
      },
      audit(actor, "reservation.depositTaken", (saved) => [
        ...singleChange("deposit", null, saved.deposit?.amount),
        ...singleChange("paymentMethod", null, saved.deposit?.method),
      ]),
    );
  }
}

/**
 * Once a booking is over — the party left, never came, or it was cancelled — its
 * held deposit is handed back the way it came, or kept as income (a no-show fee, a
 * late cancellation, or towards the bill, as agreed with the guest).
 */
export class SettleReservationDeposit {
  constructor(
    private readonly reservations: Pick<IReservationRepository, "getById">,
    private readonly deposits: IReservationDepositRepository,
  ) {}

  async execute(
    id: string,
    to: ReservationDepositSettlement,
    actor: ActivityActor,
    now: Date = new Date(),
  ): Promise<Reservation> {
    const current = await this.reservations.getById(id);
    if (!current) throw new NotFoundError("reservation", id);
    if (!canSettleReservationDeposit(current)) {
      throw new ConflictError(
        "INVALID_TRANSITION",
        current.deposit?.state === "held"
          ? "A deposit is settled once the booking is over."
          : "This booking has no deposit held.",
      );
    }

    return this.deposits.settleDeposit(
      id,
      to,
      (saved) => {
        const entry = reservationDepositSettledEntry(saved, cafeDayOf(now), actor);
        return entry ? [entry] : [];
      },
      audit(actor, SETTLE_ACTIONS[to], (saved) => singleChange("depositState", "held", saved.deposit?.state)),
    );
  }
}
