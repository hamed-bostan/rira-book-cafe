import { describe, expect, it, vi } from "vitest";

import { canTransitionReservation, nextReservationStatuses, reservationEndsAt, type Reservation } from "../../../entities/Reservation";
import { ListOwnReservations, ListReservationsForDay } from "../ReservationQueries";

import type { IReservationRepository } from "../../../repositories/IReservationRepository";

const RESERVATION: Reservation = {
  id: "r1",
  reference: 12,
  userId: "g1",
  guestName: "Sara",
  guestPhone: "0912",
  partySize: 4,
  startsAt: "2026-10-21T16:00:00.000Z",
  durationMinutes: 90,
  status: "confirmed",
  createdAt: "",
  updatedAt: "",
};

type Fake = {
  repo: IReservationRepository;
  listBetween: ReturnType<typeof vi.fn<IReservationRepository["listBetween"]>>;
  listForUser: ReturnType<typeof vi.fn<IReservationRepository["listForUser"]>>;
};

function reservations(): Fake {
  const listBetween = vi.fn<IReservationRepository["listBetween"]>(async () => [RESERVATION]);
  const listForUser = vi.fn<IReservationRepository["listForUser"]>(async () => [RESERVATION]);
  return { repo: { listBetween, listForUser } as unknown as IReservationRepository, listBetween, listForUser };
}

describe("ListReservationsForDay", () => {
  it("reads the cafe day in Tehran time, not UTC", async () => {
    const { repo, listBetween } = reservations();
    expect(await new ListReservationsForDay(repo).execute("2026-10-21", "confirmed")).toEqual([RESERVATION]);
    const [from, to, status] = listBetween.mock.calls[0];
    // Midnight in Tehran (+03:30) is 20:30 UTC the day before.
    expect(from.toISOString()).toBe("2026-10-20T20:30:00.000Z");
    expect(to.toISOString()).toBe("2026-10-21T20:30:00.000Z");
    expect(status).toBe("confirmed");
  });

  it("lists every status when none is given", async () => {
    const { repo, listBetween } = reservations();
    await new ListReservationsForDay(repo).execute("2026-10-21");
    expect(listBetween.mock.calls[0][2]).toBeUndefined();
  });
});

describe("ListOwnReservations", () => {
  it("reads the guest's own reservations", async () => {
    const { repo, listForUser } = reservations();
    await new ListOwnReservations(repo).execute("g1");
    expect(listForUser).toHaveBeenCalledWith("g1");
  });
});

describe("Reservation entity helpers", () => {
  it("knows the workflow and when a table frees up", () => {
    expect(canTransitionReservation("requested", "confirmed")).toBe(true);
    expect(canTransitionReservation("completed", "confirmed")).toBe(false);
    expect(nextReservationStatuses("completed")).toEqual([]);
    expect(reservationEndsAt(RESERVATION).toISOString()).toBe("2026-10-21T17:30:00.000Z");
  });
});
