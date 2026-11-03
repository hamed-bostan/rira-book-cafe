import { describe, expect, it, vi } from "vitest";

import {
  SUITE_STAY_DETAILS,
  editableSuiteStayDetails,
  type SuiteBooking,
  type SuiteBookingStatus,
} from "../../../entities/SuiteBooking";
import { ConflictError } from "../../../errors/ConflictError";
import { NotFoundError } from "../../../errors/NotFoundError";
import { ValidationError } from "../../../errors/ValidationError";
import { EditSuiteStay } from "../EditSuiteStay";

import type { NewActivityEntry } from "../../../entities/ActivityEntry";
import type { ISuiteBookingRepository } from "../../../repositories/ISuiteBookingRepository";

// 13:30 on 2026-10-20 in Tehran.
const NOW = new Date("2026-10-20T10:00:00Z");
const STAFF = { id: "a1", name: "Ali" };
const SAVED_AT = "2026-10-20T10:00:01.000Z";

function booking(status: SuiteBookingStatus, overrides: Partial<SuiteBooking> = {}): SuiteBooking {
  return {
    id: "s1",
    reference: 4,
    userId: "09120000004",
    guestName: "Sara",
    guestPhone: "+98 912 000 0004",
    guests: 2,
    checkIn: "2026-10-25",
    checkOut: "2026-10-27",
    status,
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...overrides,
  };
}

function setup(current: SuiteBooking | null) {
  const entries: (NewActivityEntry | null)[] = [];
  const applyStayEdit = vi.fn<ISuiteBookingRepository["applyStayEdit"]>(async (_id, _expected, edit, audit) => {
    const saved: SuiteBooking = { ...(current as SuiteBooking), ...edit, updatedAt: SAVED_AT };
    if (audit) entries.push(audit(saved));
    return saved;
  });
  const repo = { getById: vi.fn(async () => current), applyStayEdit } as unknown as ISuiteBookingRepository;
  const notifier = { notify: vi.fn(async () => undefined) };
  return { useCase: new EditSuiteStay(repo, notifier), applyStayEdit, notifier, entries };
}

describe("editableSuiteStayDetails", () => {
  it("lets the days and party change before arrival, only the departure once in, nothing after", () => {
    expect(editableSuiteStayDetails({ status: "requested" })).toEqual(SUITE_STAY_DETAILS);
    expect(editableSuiteStayDetails({ status: "confirmed" })).toEqual(SUITE_STAY_DETAILS);
    expect(editableSuiteStayDetails({ status: "checkedIn" })).toEqual(["checkOut"]);
    for (const status of ["checkedOut", "cancelled", "noShow"] as const) {
      expect(editableSuiteStayDetails({ status })).toEqual([]);
    }
  });
});

describe("EditSuiteStay", () => {
  it("moves a confirmed stay, logs the days that moved, and tells the guest by phone", async () => {
    const { useCase, applyStayEdit, notifier, entries } = setup(booking("confirmed"));
    await useCase.execute("s1", { checkIn: "2026-10-28", checkOut: "2026-10-31", guests: 2 }, STAFF, NOW);

    expect(applyStayEdit.mock.calls[0].slice(0, 3)).toEqual([
      "s1",
      "confirmed",
      { checkIn: "2026-10-28", checkOut: "2026-10-31", guests: 2 },
    ]);
    expect(entries[0]).toEqual({
      actorId: "a1",
      actorName: "Ali",
      action: "suiteBooking.changed",
      entityType: "suiteBooking",
      entityId: "s1",
      entityLabel: "S-4",
      changes: [
        { field: "checkIn", before: "2026-10-25", after: "2026-10-28" },
        { field: "checkOut", before: "2026-10-27", after: "2026-10-31" },
      ],
    });
    expect(notifier.notify).toHaveBeenCalledWith({
      userId: "09120000004",
      kind: "suiteChanged",
      params: { reference: 4, checkIn: "2026-10-28", checkOut: "2026-10-31", guests: 2 },
      link: "/suite",
      dedupeKey: `suite:s1:changed:${SAVED_AT}`,
    });
  });

  it("extends or shortens a checked-in stay, and nothing else about it", async () => {
    const inNow = booking("checkedIn", { checkIn: "2026-10-18", checkOut: "2026-10-21" });
    for (const checkOut of ["2026-10-24", "2026-10-20"]) {
      const { useCase, applyStayEdit, notifier } = setup(inNow);
      await useCase.execute("s1", { checkIn: "2026-10-18", checkOut, guests: 2 }, STAFF, NOW);
      expect(applyStayEdit.mock.calls[0][2]).toEqual({ checkIn: "2026-10-18", checkOut, guests: 2 });
      expect(notifier.notify).toHaveBeenCalledOnce();
    }
    for (const input of [{ checkIn: "2026-10-19" }, { guests: 3 }]) {
      const { useCase, applyStayEdit } = setup(inNow);
      await expect(useCase.execute("s1", input, STAFF, NOW)).rejects.toThrow(ValidationError);
      expect(applyStayEdit).not.toHaveBeenCalled();
    }
  });

  it("won't move a departure into the past", async () => {
    const { useCase } = setup(booking("checkedIn", { checkIn: "2026-10-15", checkOut: "2026-10-21" }));
    await expect(useCase.execute("s1", { checkOut: "2026-10-19" }, STAFF, NOW)).rejects.toMatchObject({
      field: "checkOut",
    });
  });

  it("holds new days to the booking rules", async () => {
    for (const [input, field] of [
      [{ checkIn: "2026-10-19", checkOut: "2026-10-21" }, "checkIn"],
      [{ checkIn: "2027-03-01", checkOut: "2027-03-03" }, "checkIn"],
      [{ checkOut: "2026-10-25" }, "checkOut"],
      [{ checkOut: "2026-11-25" }, "checkOut"],
      [{ checkIn: "2026-13-01" }, "checkIn"],
      [{ guests: 5 }, "guests"],
    ] as const) {
      const { useCase, applyStayEdit } = setup(booking("requested"));
      await expect(useCase.execute("s1", input, STAFF, NOW)).rejects.toMatchObject({ field });
      expect(applyStayEdit).not.toHaveBeenCalled();
    }
  });

  it("changes the party alone, and lets an overdue arrival keep its day", async () => {
    const overdue = booking("confirmed", { checkIn: "2026-10-19", checkOut: "2026-10-22" });
    const { useCase, applyStayEdit } = setup(overdue);
    await useCase.execute("s1", { checkIn: "2026-10-19", guests: 3 }, STAFF, NOW);
    expect(applyStayEdit.mock.calls[0][2]).toEqual({ checkIn: "2026-10-19", checkOut: "2026-10-22", guests: 3 });
  });

  it("does nothing when nothing changes", async () => {
    const current = booking("confirmed");
    const { useCase, applyStayEdit, notifier } = setup(current);
    expect(await useCase.execute("s1", { checkIn: "2026-10-25", guests: 2 }, STAFF, NOW)).toBe(current);
    expect(applyStayEdit).not.toHaveBeenCalled();
    expect(notifier.notify).not.toHaveBeenCalled();
  });

  it("refuses a stay that's over, and one that doesn't exist", async () => {
    for (const status of ["checkedOut", "cancelled", "noShow"] as const) {
      await expect(setup(booking(status)).useCase.execute("s1", { guests: 1 }, STAFF, NOW)).rejects.toThrow(
        ConflictError,
      );
    }
    await expect(setup(null).useCase.execute("s1", { guests: 1 }, STAFF, NOW)).rejects.toThrow(NotFoundError);
  });

  it("tells the guest nothing when the nights are taken", async () => {
    const { useCase, applyStayEdit, notifier } = setup(booking("confirmed"));
    applyStayEdit.mockRejectedValueOnce(new ConflictError("SUITE_TAKEN", "The suite is already booked."));
    await expect(useCase.execute("s1", { checkOut: "2026-10-29" }, STAFF, NOW)).rejects.toMatchObject({
      code: "SUITE_TAKEN",
    });
    expect(notifier.notify).not.toHaveBeenCalled();
  });
});
