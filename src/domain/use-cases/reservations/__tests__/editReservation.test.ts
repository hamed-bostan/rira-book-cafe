import { describe, expect, it, vi } from "vitest";

import { wallTimeToDate } from "../../../entities/CafeTime";
import {
  RESERVATION_DETAILS,
  editableReservationDetails,
  type Reservation,
  type ReservationStatus,
} from "../../../entities/Reservation";
import { ConflictError } from "../../../errors/ConflictError";
import { NotFoundError } from "../../../errors/NotFoundError";
import { ValidationError } from "../../../errors/ValidationError";
import { EditReservation } from "../EditReservation";

import type { NewActivityEntry } from "../../../entities/ActivityEntry";
import type { IReservationRepository, ReservationEdit } from "../../../repositories/IReservationRepository";

const NOW = new Date("2026-10-20T10:00:00Z");
const STAFF = { id: "s1", name: "Ali" };
const SAVED_AT = "2026-10-20T10:00:01.000Z";

function reservation(status: ReservationStatus, overrides: Partial<Reservation> = {}): Reservation {
  return {
    id: "r1",
    reference: 12,
    guestName: "Omid Karimi",
    guestPhone: "0935 640 1182",
    partySize: 4,
    // 19:30 on the 21st, cafe time.
    startsAt: "2026-10-21T16:00:00.000Z",
    durationMinutes: 90,
    status,
    tableLabel: status === "requested" ? undefined : "4",
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...overrides,
  };
}

function setup(current: Reservation | null) {
  const entries: (NewActivityEntry | null)[] = [];
  const applyEdit = vi.fn<IReservationRepository["applyEdit"]>(async (_id, _expected, edit: ReservationEdit, audit) => {
    const saved: Reservation = {
      ...(current as Reservation),
      ...edit,
      note: edit.note ?? undefined,
      tableLabel: edit.tableLabel ?? undefined,
      updatedAt: SAVED_AT,
    };
    if (audit) entries.push(audit(saved));
    return saved;
  });
  const repo = { getById: vi.fn(async () => current), applyEdit } as unknown as IReservationRepository;
  const notifier = { notify: vi.fn(async () => undefined) };
  return { useCase: new EditReservation(repo, notifier), applyEdit, notifier, entries };
}

describe("editableReservationDetails", () => {
  it("lets everything change while a booking is ahead, only the length and table once seated, nothing after", () => {
    for (const status of ["requested", "confirmed"] as const) {
      expect(editableReservationDetails({ status })).toEqual(RESERVATION_DETAILS);
    }
    expect(editableReservationDetails({ status: "seated" })).toEqual(["durationMinutes", "tableLabel"]);
    for (const status of ["completed", "cancelled", "noShow"] as const) {
      expect(editableReservationDetails({ status })).toEqual([]);
    }
  });

  it("keeps a guest's own booking on their account's phone", () => {
    expect(editableReservationDetails({ status: "confirmed", userId: "09120000004" })).not.toContain("guestPhone");
    expect(editableReservationDetails({ status: "confirmed", userId: "09120000004" })).toContain("guestName");
  });
});

describe("EditReservation", () => {
  it("moves a booking to another day and time, logs both sides, and tells the guest by phone", async () => {
    const { useCase, applyEdit, notifier, entries } = setup(reservation("confirmed"));
    const saved = await useCase.execute(
      "r1",
      { startsAt: wallTimeToDate("2026-10-23T23:30"), partySize: 4, durationMinutes: 120 },
      STAFF,
      NOW,
    );

    expect(applyEdit.mock.calls[0].slice(0, 3)).toEqual([
      "r1",
      "confirmed",
      {
        startsAt: "2026-10-23T20:00:00.000Z",
        partySize: 4,
        durationMinutes: 120,
        guestName: "Omid Karimi",
        guestPhone: "0935 640 1182",
        note: null,
        tableLabel: "4",
      },
    ]);
    expect(entries[0]).toEqual({
      actorId: "s1",
      actorName: "Ali",
      action: "reservation.changed",
      entityType: "reservation",
      entityId: "r1",
      entityLabel: "R-12",
      changes: [
        { field: "startsAt", before: "2026-10-21T16:00:00.000Z", after: "2026-10-23T20:00:00.000Z" },
        { field: "durationMinutes", before: "90", after: "120" },
      ],
    });
    expect(notifier.notify).toHaveBeenCalledOnce();
    expect(notifier.notify).toHaveBeenCalledWith({
      // A phone booking has no account: the notice waits under the guest's phone.
      userId: "09356401182",
      kind: "reservationChanged",
      params: { reference: 12, startsAt: saved.startsAt, partySize: 4, durationMinutes: 120 },
      link: "/reservations",
      dedupeKey: `reservation:r1:changed:${SAVED_AT}`,
    });
  });

  it("tells the guest about a new party size or length, but not a new name, note or table", async () => {
    for (const input of [{ partySize: 6 }, { durationMinutes: 60 }]) {
      const { useCase, notifier } = setup(reservation("confirmed"));
      await useCase.execute("r1", input, STAFF, NOW);
      expect(notifier.notify).toHaveBeenCalledWith(expect.objectContaining({ kind: "reservationChanged" }));
    }
    for (const input of [{ guestName: "Omid K." }, { note: "Window seat" }, { tableLabel: "5" }]) {
      const { useCase, applyEdit, notifier } = setup(reservation("confirmed"));
      await useCase.execute("r1", input, STAFF, NOW);
      expect(applyEdit).toHaveBeenCalledOnce();
      expect(notifier.notify).not.toHaveBeenCalled();
    }
  });

  it("lets a seated party change only its length and table", async () => {
    const seated = reservation("seated", { startsAt: "2026-10-20T09:30:00.000Z" });
    for (const input of [
      { startsAt: wallTimeToDate("2026-10-20T14:00") },
      { partySize: 5 },
      { guestName: "Someone else" },
      { guestPhone: "0912 000 0000" },
      { note: "Late" },
    ]) {
      const { useCase, applyEdit } = setup(seated);
      await expect(useCase.execute("r1", input, STAFF, NOW)).rejects.toThrow(ValidationError);
      expect(applyEdit).not.toHaveBeenCalled();
    }

    const { useCase, applyEdit } = setup(seated);
    // Its start is behind it, but it doesn't move, so that's not checked.
    await useCase.execute(
      "r1",
      { startsAt: new Date(seated.startsAt), durationMinutes: 180, tableLabel: "5" },
      STAFF,
      NOW,
    );
    expect(applyEdit.mock.calls[0][2]).toMatchObject({ durationMinutes: 180, tableLabel: "5" });
  });

  it("won't leave a seated party without a table", async () => {
    const { useCase } = setup(reservation("seated"));
    await expect(useCase.execute("r1", { tableLabel: null }, STAFF, NOW)).rejects.toMatchObject({
      field: "tableLabel",
    });
  });

  it("keeps the phone of a guest's own booking, and lets their name be corrected", async () => {
    const own = reservation("requested", { userId: "09120000004", guestPhone: "09120000004" });
    await expect(setup(own).useCase.execute("r1", { guestPhone: "09350000000" }, STAFF, NOW)).rejects.toMatchObject({
      field: "guestPhone",
    });

    const { useCase, applyEdit } = setup(own);
    await useCase.execute("r1", { guestName: "  Sara Ahmadi ", guestPhone: "09120000004" }, STAFF, NOW);
    expect(applyEdit.mock.calls[0][2]).toMatchObject({ guestName: "Sara Ahmadi", guestPhone: "09120000004" });
  });

  it("changes a walk-in's phone, and tells them at the new number", async () => {
    const { useCase, applyEdit, notifier } = setup(reservation("confirmed"));
    await useCase.execute("r1", { guestPhone: " +98 912 111 2233 ", partySize: 3 }, STAFF, NOW);
    expect(applyEdit.mock.calls[0][2]).toMatchObject({ guestPhone: "+98 912 111 2233" });
    expect(notifier.notify).toHaveBeenCalledWith(expect.objectContaining({ userId: "09121112233" }));
  });

  it("holds a new time to the booking rules: any quarter hour, not in the past, within the horizon", async () => {
    for (const startsAt of [
      new Date("2026-10-20T09:00:00Z"),
      wallTimeToDate("2026-10-22T19:10"),
      wallTimeToDate("2027-01-30T19:00"),
      new Date("not a date"),
    ]) {
      const { useCase, applyEdit } = setup(reservation("confirmed"));
      await expect(useCase.execute("r1", { startsAt }, STAFF, NOW)).rejects.toMatchObject({ field: "startsAt" });
      expect(applyEdit).not.toHaveBeenCalled();
    }
    // The quarter hour already running is fine for staff, as for a walk-in.
    const { useCase } = setup(reservation("confirmed"));
    await useCase.execute("r1", { startsAt: new Date("2026-10-20T09:45:00Z") }, STAFF, NOW);
  });

  it("takes only the offered lengths, party sizes and floor tables", async () => {
    for (const [input, field] of [
      [{ durationMinutes: 45 }, "durationMinutes"],
      [{ durationMinutes: 600 }, "durationMinutes"],
      [{ partySize: 13 }, "partySize"],
      [{ tableLabel: "Patio" }, "tableLabel"],
      [{ guestName: "  " }, "guestName"],
    ] as const) {
      const { useCase, applyEdit } = setup(reservation("confirmed"));
      await expect(useCase.execute("r1", input, STAFF, NOW)).rejects.toMatchObject({ field });
      expect(applyEdit).not.toHaveBeenCalled();
    }
  });

  it("clears the note when it's emptied, and keeps a legacy length it isn't asked to change", async () => {
    const { useCase, applyEdit } = setup(reservation("confirmed", { note: "Birthday", durationMinutes: 75 }));
    await useCase.execute("r1", { note: "  ", durationMinutes: 75 }, STAFF, NOW);
    expect(applyEdit.mock.calls[0][2]).toMatchObject({ note: null, durationMinutes: 75 });
  });

  it("does nothing when nothing changes", async () => {
    const current = reservation("confirmed");
    const { useCase, applyEdit, notifier } = setup(current);
    expect(
      await useCase.execute(
        "r1",
        { startsAt: new Date(current.startsAt), partySize: 4, guestName: "Omid Karimi ", tableLabel: "4" },
        STAFF,
        NOW,
      ),
    ).toBe(current);
    expect(applyEdit).not.toHaveBeenCalled();
    expect(notifier.notify).not.toHaveBeenCalled();
  });

  it("refuses a booking that's over, and one that doesn't exist", async () => {
    for (const status of ["completed", "cancelled", "noShow"] as const) {
      await expect(setup(reservation(status)).useCase.execute("r1", { partySize: 2 }, STAFF, NOW)).rejects.toThrow(
        ConflictError,
      );
    }
    await expect(setup(null).useCase.execute("r1", { partySize: 2 }, STAFF, NOW)).rejects.toThrow(NotFoundError);
  });

  it("tells the guest nothing when the table is taken at the new time", async () => {
    const { useCase, applyEdit, notifier } = setup(reservation("confirmed"));
    applyEdit.mockRejectedValueOnce(new ConflictError("TABLE_TAKEN", "Table 4 is already booked."));
    await expect(
      useCase.execute("r1", { startsAt: wallTimeToDate("2026-10-22T19:00") }, STAFF, NOW),
    ).rejects.toMatchObject({ code: "TABLE_TAKEN" });
    expect(notifier.notify).not.toHaveBeenCalled();
  });
});
