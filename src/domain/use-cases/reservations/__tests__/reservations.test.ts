import { describe, expect, it, vi } from "vitest";

import {
  RESERVATION_STATUSES,
  canUndoReservationStatus,
  isGuestCancellableReservation,
  rangesOverlap,
  type Reservation,
  type ReservationStatus,
} from "../../../entities/Reservation";
import { ConflictError } from "../../../errors/ConflictError";
import { NotFoundError } from "../../../errors/NotFoundError";
import { ValidationError } from "../../../errors/ValidationError";
import { CancelOwnReservation, ChangeReservation } from "../ChangeReservation";
import { RequestReservation } from "../RequestReservation";

import type { IReservationRepository, ReservationChange } from "../../../repositories/IReservationRepository";

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
  const create = vi.fn(async (input: Omit<Reservation, "id" | "reference" | "status" | "createdAt" | "updatedAt">) => ({
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
});

describe("ChangeReservation", () => {
  it("confirms with a table and audits both changes", async () => {
    const { repo, applyChange } = repoWith(reservation("requested"));
    await new ChangeReservation(repo).execute(
      "r1",
      { status: "confirmed", tableLabel: " 4 " },
      { id: "s", name: "Ali" },
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

  it("requires a table to seat a party", async () => {
    const { repo } = repoWith(reservation("confirmed"));
    await expect(
      new ChangeReservation(repo).execute("r1", { status: "seated" }, { id: "s", name: "Ali" }),
    ).rejects.toThrow(ValidationError);
  });

  it("refuses transitions the workflow doesn't allow", async () => {
    const { repo, applyChange } = repoWith(reservation("completed"));
    await expect(
      new ChangeReservation(repo).execute("r1", { status: "seated", tableLabel: "4" }, { id: "s", name: "Ali" }),
    ).rejects.toThrow(ConflictError);
    expect(applyChange).not.toHaveBeenCalled();
  });

  it("does nothing when nothing changes", async () => {
    const current = reservation("confirmed", { tableLabel: "4" });
    const { repo, applyChange } = repoWith(current);
    expect(await new ChangeReservation(repo).execute("r1", { tableLabel: "4" }, { id: "s", name: "Ali" })).toBe(
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
    await new ChangeReservation(repo).execute("r1", { status: "seated", undo: true }, { id: "s", name: "Ali" });
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
        new ChangeReservation(repo).execute("r1", { status: to, undo: true }, { id: "s", name: "Ali" }),
      ).rejects.toThrow(ConflictError);
      expect(applyChange).not.toHaveBeenCalled();
    }
    await expect(
      new ChangeReservation(repoWith(reservation("seated", { tableLabel: "4" })).repo).execute(
        "r1",
        { status: "confirmed", tableLabel: "5", undo: true },
        { id: "s", name: "Ali" },
      ),
    ).rejects.toThrow(ValidationError);
  });

  it("never steps back without the undo flag", async () => {
    await expect(
      new ChangeReservation(repoWith(reservation("seated", { tableLabel: "4" })).repo).execute(
        "r1",
        { status: "confirmed" },
        { id: "s", name: "Ali" },
      ),
    ).rejects.toThrow(ConflictError);
  });

  it("still tells the guest when a request is confirmed", async () => {
    const notifier = { notify: vi.fn() };
    await new ChangeReservation(repoWith(reservation("requested")).repo, notifier).execute(
      "r1",
      { status: "confirmed", tableLabel: "4" },
      { id: "s", name: "Ali" },
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
