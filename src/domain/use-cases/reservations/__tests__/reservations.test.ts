import { describe, expect, it, vi } from "vitest";

import {
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
