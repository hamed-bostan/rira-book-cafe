import { describe, expect, it, vi } from "vitest";

import { cafeDayOf, dateToWallTime, wallTimeToDate } from "../../../entities/CafeTime";
import {
  BOOKING_TIMES,
  RESERVATION_STATUSES,
  canUndoReservationStatus,
  isGuestCancellableReservation,
  rangesOverlap,
  reservationEndsAt,
  type Reservation,
  type ReservationStatus,
} from "../../../entities/Reservation";
import { ConflictError } from "../../../errors/ConflictError";
import { NotFoundError } from "../../../errors/NotFoundError";
import { ValidationError } from "../../../errors/ValidationError";
import { CancelOwnReservation, ChangeReservation } from "../ChangeReservation";
import { BookTableForGuest, RequestReservation } from "../RequestReservation";

import type {
  IReservationRepository,
  NewReservation,
  ReservationChange,
} from "../../../repositories/IReservationRepository";

const NOW = new Date("2026-10-20T10:00:00Z");
const GUEST = { id: "g1", name: "Sara", phone: "0912" };

function reservation(status: ReservationStatus, overrides: Partial<Reservation> = {}): Reservation {
  return {
    id: "r1",
    reference: 12,
    userId: "g1",
    guestName: "Sara",
    guestPhone: "0912",
    partySize: 4,
    startsAt: "2026-10-21T16:00:00.000Z",
    durationMinutes: 90,
    status,
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...overrides,
  };
}

function repoWith(current: Reservation | null) {
  const applyChange = vi.fn(
    async (
      _id: string,
      _expected: ReservationStatus,
      change: ReservationChange,
      _actor: unknown,
      _audit?: (saved: Reservation) => unknown,
    ) => ({
      ...(current as Reservation),
      status: change.status,
      tableLabel: change.tableLabel ?? undefined,
    }),
  );
  const create = vi.fn(async (input: NewReservation) => ({
    ...reservation("requested"),
    ...input,
  }));
  const repo = { getById: vi.fn(async () => current), applyChange, create } as unknown as IReservationRepository;
  return { repo, applyChange, create };
}

describe("RequestReservation", () => {
  it("books a future quarter-hour slot as requested", async () => {
    const { repo, create } = repoWith(null);
    await new RequestReservation(repo).execute(
      { startsAt: new Date("2026-10-21T16:15:00Z"), partySize: 2 },
      GUEST,
      NOW,
    );
    expect(create.mock.calls[0][0]).toMatchObject({ guestName: "Sara", partySize: 2, durationMinutes: 90 });
  });

  it("refuses the past, off-slot times, too-far dates and bad party sizes", async () => {
    const { repo } = repoWith(null);
    const useCase = new RequestReservation(repo);
    for (const input of [
      { startsAt: new Date("2026-10-20T09:00:00Z"), partySize: 2 },
      { startsAt: new Date("2026-10-21T16:10:00Z"), partySize: 2 },
      { startsAt: new Date("2027-01-30T16:00:00Z"), partySize: 2 },
      { startsAt: new Date("2026-10-21T16:00:00Z"), partySize: 13 },
    ]) {
      await expect(useCase.execute(input, GUEST, NOW)).rejects.toThrow(ValidationError);
    }
  });

  it("takes any quarter hour of the day, midnight and the small hours included", async () => {
    const { repo, create } = repoWith(null);
    const useCase = new RequestReservation(repo);
    for (const time of ["00:00", "03:15", "07:45", "21:15", "23:30", "23:45"]) {
      await useCase.execute({ startsAt: wallTimeToDate(`2026-10-21T${time}`), partySize: 2 }, GUEST, NOW);
    }
    expect(create).toHaveBeenCalledTimes(6);
  });
});

describe("BookTableForGuest", () => {
  const walkIn = { guestName: "Omid", guestPhone: "0935 640 1182", partySize: 2 };
  const noProfiles = { getById: async () => null };

  it("books staff's late or early guests at any hour, still on a quarter-hour mark", async () => {
    const { repo, create } = repoWith(null);
    const useCase = new BookTableForGuest(repo, noProfiles);
    for (const time of ["23:30", "02:00"]) {
      await useCase.execute(
        { ...walkIn, startsAt: wallTimeToDate(`2026-10-21T${time}`) },
        { id: "s", name: "Ali" },
        NOW,
      );
    }
    expect(create).toHaveBeenCalledTimes(2);

    await expect(
      useCase.execute({ ...walkIn, startsAt: wallTimeToDate("2026-10-21T23:20") }, { id: "s", name: "Ali" }, NOW),
    ).rejects.toMatchObject({ field: "startsAt" });
  });

  it("books for the profile the phone finds, or makes one with the booking", async () => {
    const staff = { id: "s", name: "Ali" };
    const startsAt = wallTimeToDate("2026-10-21T19:00");

    const fresh = repoWith(null);
    await new BookTableForGuest(fresh.repo, noProfiles).execute({ ...walkIn, startsAt }, staff, NOW);
    expect(fresh.create.mock.calls[0][0]).toMatchObject({
      userId: "09356401182",
      guestName: "Omid",
      guestPhone: "0935 640 1182",
      newGuest: { id: "09356401182", name: "Omid", createdBy: staff },
    });

    const known = repoWith(null);
    const profile = {
      id: "09356401182",
      phone: "09356401182",
      name: "Omid Karimi",
      email: null,
      avatarUrl: null,
      role: "customer" as const,
    };
    const profiles = { getById: async () => profile };
    await new BookTableForGuest(known.repo, profiles).execute({ ...walkIn, startsAt }, staff, NOW);
    const booked = known.create.mock.calls[0][0];
    expect(booked).toMatchObject({ userId: "09356401182", guestName: "Omid Karimi" });
    expect(booked.newGuest).toBeUndefined();
  });
});

describe("booking times", () => {
  it("offers every quarter hour of the day, from 00:00 to 23:45", () => {
    expect(BOOKING_TIMES[0]).toBe("00:00");
    expect(BOOKING_TIMES[1]).toBe("00:15");
    expect(BOOKING_TIMES.at(-1)).toBe("23:45");
    expect(BOOKING_TIMES).toHaveLength(96);
    expect(new Set(BOOKING_TIMES).size).toBe(96);
  });

  it("lets a late booking run past midnight, ending on the next day", () => {
    const late = { startsAt: wallTimeToDate("2026-10-21T23:30").toISOString(), durationMinutes: 90 };
    expect(dateToWallTime(reservationEndsAt(late))).toBe("2026-10-22T01:00");
    // It stays on the day it starts: the day view, the overview and the guest's list go by the start.
    expect(cafeDayOf(new Date(late.startsAt))).toBe("2026-10-21");
    // And it overlaps a booking just after midnight at the same table.
    const after = { startsAt: wallTimeToDate("2026-10-22T00:30").toISOString(), durationMinutes: 60 };
    expect(
      rangesOverlap(
        new Date(late.startsAt),
        reservationEndsAt(late),
        new Date(after.startsAt),
        reservationEndsAt(after),
      ),
    ).toBe(true);
  });
});

describe("ChangeReservation", () => {
  it("confirms with a table and audits both changes", async () => {
    const { repo, applyChange } = repoWith(reservation("requested"));
    await new ChangeReservation(repo).execute(
      "r1",
      { status: "confirmed", tableLabel: " 4 " },
      { id: "s", name: "Ali" },
      NOW,
    );

    expect(applyChange.mock.calls[0].slice(0, 3)).toEqual([
      "r1",
      "requested",
      { status: "confirmed", tableLabel: "4" },
    ]);
    const audit = applyChange.mock.calls[0][4];
    const entry = audit?.(reservation("confirmed", { tableLabel: "4" })) as {
      changes: { field: string }[];
      entityLabel: string;
    };
    expect(entry.entityLabel).toBe("R-12");
    expect(entry.changes.map((c) => c.field)).toEqual(["status", "tableLabel"]);
  });

  it("moves a booking only to a table on the floor plan, as a new booking takes", async () => {
    for (const tableLabel of ["Patio", "T4", "9"]) {
      const { repo, applyChange } = repoWith(reservation("confirmed", { tableLabel: "4" }));
      await expect(
        new ChangeReservation(repo).execute("r1", { tableLabel }, { id: "s", name: "Ali" }, NOW),
      ).rejects.toThrow(expect.objectContaining({ field: "tableLabel" }));
      expect(applyChange).not.toHaveBeenCalled();
    }
  });

  it("keeps a table a booking already has, even one off today's floor plan", async () => {
    const { repo, applyChange } = repoWith(reservation("confirmed", { tableLabel: "Patio" }));
    await new ChangeReservation(repo).execute("r1", { status: "seated" }, { id: "s", name: "Ali" }, NOW);
    expect(applyChange.mock.calls[0][2]).toEqual({ status: "seated", tableLabel: "Patio" });
  });

  it("refuses a no-show before the booking starts, and marks one from its start on", async () => {
    // The booking starts at 16:00 UTC on the 21st; NOW is a day earlier.
    for (const now of [NOW, new Date("2026-10-21T15:59:00Z")]) {
      const { repo, applyChange } = repoWith(reservation("confirmed", { tableLabel: "4" }));
      await expect(
        new ChangeReservation(repo).execute("r1", { status: "noShow" }, { id: "s", name: "Ali" }, now),
      ).rejects.toMatchObject({ code: "NOT_DUE_YET" });
      expect(applyChange).not.toHaveBeenCalled();
    }
    for (const now of [new Date("2026-10-21T16:00:00Z"), new Date("2026-10-21T16:45:00Z")]) {
      const { repo, applyChange } = repoWith(reservation("confirmed", { tableLabel: "4" }));
      await new ChangeReservation(repo).execute("r1", { status: "noShow" }, { id: "s", name: "Ali" }, now);
      expect(applyChange.mock.calls[0][2]).toMatchObject({ status: "noShow" });
    }
  });

  it("still seats or cancels a party ahead of their time", async () => {
    for (const status of ["seated", "cancelled"] as const) {
      const { repo, applyChange } = repoWith(reservation("confirmed", { tableLabel: "4" }));
      await new ChangeReservation(repo).execute("r1", { status }, { id: "s", name: "Ali" }, NOW);
      expect(applyChange).toHaveBeenCalledOnce();
    }
  });

  it("requires a table to seat a party", async () => {
    const { repo } = repoWith(reservation("confirmed"));
    await expect(
      new ChangeReservation(repo).execute("r1", { status: "seated" }, { id: "s", name: "Ali" }, NOW),
    ).rejects.toThrow(ValidationError);
  });

  it("refuses transitions the workflow doesn't allow", async () => {
    const { repo, applyChange } = repoWith(reservation("completed"));
    await expect(
      new ChangeReservation(repo).execute("r1", { status: "seated", tableLabel: "4" }, { id: "s", name: "Ali" }, NOW),
    ).rejects.toThrow(ConflictError);
    expect(applyChange).not.toHaveBeenCalled();
  });

  it("does nothing when nothing changes", async () => {
    const current = reservation("confirmed", { tableLabel: "4" });
    const { repo, applyChange } = repoWith(current);
    expect(await new ChangeReservation(repo).execute("r1", { tableLabel: "4" }, { id: "s", name: "Ali" }, NOW)).toBe(
      current,
    );
    expect(applyChange).not.toHaveBeenCalled();
  });

  it("takes back a Seat, keeping the table, logging it, and telling the guest nothing", async () => {
    const { repo, applyChange } = repoWith(reservation("seated", { tableLabel: "4" }));
    const notifier = { notify: vi.fn() };
    const saved = await new ChangeReservation(repo, notifier).execute(
      "r1",
      { status: "confirmed", undo: true },
      { id: "s", name: "Ali" },
      NOW,
    );

    expect(saved).toMatchObject({ status: "confirmed", tableLabel: "4" });
    expect(applyChange.mock.calls[0].slice(0, 3)).toEqual(["r1", "seated", { status: "confirmed", tableLabel: "4" }]);
    const entry = applyChange.mock.calls[0][4]?.(reservation("confirmed", { tableLabel: "4" })) as {
      action: string;
      changes: unknown[];
    };
    expect(entry.action).toBe("reservation.changed");
    expect(entry.changes).toEqual([{ field: "status", before: "seated", after: "confirmed" }]);
    // Back at `confirmed`, but the guest isn't told their table was confirmed again.
    expect(notifier.notify).not.toHaveBeenCalled();
  });

  it("takes back a Complete", async () => {
    const { repo, applyChange } = repoWith(reservation("completed", { tableLabel: "4" }));
    await new ChangeReservation(repo).execute("r1", { status: "seated", undo: true }, { id: "s", name: "Ali" }, NOW);
    expect(applyChange.mock.calls[0].slice(1, 3)).toEqual(["completed", { status: "seated", tableLabel: "4" }]);
  });

  it("refuses an undo of anything else, or one that also moves the table", async () => {
    for (const [from, to] of [
      ["confirmed", "requested"],
      ["cancelled", "confirmed"],
      ["noShow", "confirmed"],
      ["completed", "confirmed"],
      ["seated", "seated"],
    ] as const) {
      const { repo, applyChange } = repoWith(reservation(from, { tableLabel: "4" }));
      await expect(
        new ChangeReservation(repo).execute("r1", { status: to, undo: true }, { id: "s", name: "Ali" }, NOW),
      ).rejects.toThrow(ConflictError);
      expect(applyChange).not.toHaveBeenCalled();
    }
    await expect(
      new ChangeReservation(repoWith(reservation("seated", { tableLabel: "4" })).repo).execute(
        "r1",
        { status: "confirmed", tableLabel: "5", undo: true },
        { id: "s", name: "Ali" },
        NOW,
      ),
    ).rejects.toThrow(ValidationError);
  });

  it("never steps back without the undo flag", async () => {
    await expect(
      new ChangeReservation(repoWith(reservation("seated", { tableLabel: "4" })).repo).execute(
        "r1",
        { status: "confirmed" },
        { id: "s", name: "Ali" },
        NOW,
      ),
    ).rejects.toThrow(ConflictError);
  });

  it("still tells the guest when a request is confirmed", async () => {
    const notifier = { notify: vi.fn() };
    await new ChangeReservation(repoWith(reservation("requested")).repo, notifier).execute(
      "r1",
      { status: "confirmed", tableLabel: "4" },
      { id: "s", name: "Ali" },
      NOW,
    );
    expect(notifier.notify).toHaveBeenCalledWith(expect.objectContaining({ kind: "reservationConfirmed" }));
  });
});

describe("canUndoReservationStatus", () => {
  it("allows exactly seated → confirmed and completed → seated", () => {
    const allowed = RESERVATION_STATUSES.flatMap((from) =>
      RESERVATION_STATUSES.filter((to) => canUndoReservationStatus(from, to)).map((to) => `${from}→${to}`),
    );
    expect(allowed).toEqual(["seated→confirmed", "completed→seated"]);
  });
});

describe("CancelOwnReservation", () => {
  it("lets the guest cancel before it starts, and hides other guests' bookings", async () => {
    const { repo } = repoWith(reservation("confirmed"));
    expect((await new CancelOwnReservation(repo).execute("r1", { id: "g1", name: "Sara" }, NOW)).status).toBe(
      "cancelled",
    );
    await expect(
      new CancelOwnReservation(repoWith(reservation("confirmed", { userId: "x" })).repo).execute(
        "r1",
        { id: "g1", name: "Sara" },
        NOW,
      ),
    ).rejects.toThrow(NotFoundError);
  });

  it("refuses once seated or started", () => {
    expect(isGuestCancellableReservation(reservation("seated"), NOW)).toBe(false);
    expect(isGuestCancellableReservation(reservation("confirmed"), new Date("2026-10-21T17:00:00Z"))).toBe(false);
  });
});

describe("rangesOverlap", () => {
  it("treats back-to-back bookings as free", () => {
    const at = (h: number) => new Date(Date.UTC(2026, 9, 21, h));
    expect(rangesOverlap(at(16), at(18), at(18), at(19))).toBe(false);
    expect(rangesOverlap(at(16), at(18), at(17), at(19))).toBe(true);
  });
});
