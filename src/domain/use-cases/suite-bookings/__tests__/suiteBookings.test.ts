import { describe, expect, it, vi } from "vitest";

import {
  SUITE_BOOKING_STATUSES,
  canUndoSuiteBookingStatus,
  isGuestCancellableSuiteBooking,
  staysOverlap,
  suiteNights,
  type SuiteBooking,
  type SuiteBookingStatus,
} from "../../../entities/SuiteBooking";
import { ConflictError } from "../../../errors/ConflictError";
import { NotFoundError } from "../../../errors/NotFoundError";
import { ValidationError } from "../../../errors/ValidationError";
import { CancelOwnSuiteBooking, ChangeSuiteBooking } from "../ChangeSuiteBooking";
import { RequestSuiteBooking } from "../RequestSuiteBooking";

import type { ISuiteBookingRepository, NewSuiteBooking } from "../../../repositories/ISuiteBookingRepository";

// 13:30 on 2026-10-20 in Tehran.
const NOW = new Date("2026-10-20T10:00:00Z");
const GUEST = { id: "g1", name: "Sara", phone: "0912" };

function booking(status: SuiteBookingStatus, overrides: Partial<SuiteBooking> = {}): SuiteBooking {
  return {
    id: "s1",
    reference: 4,
    userId: "g1",
    guestName: "Sara",
    guestPhone: "0912",
    guests: 2,
    checkIn: "2026-10-25",
    checkOut: "2026-10-27",
    status,
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...overrides,
  };
}

function repoWith(current: SuiteBooking | null) {
  const create = vi.fn(async (input: NewSuiteBooking) => ({ ...booking("requested"), ...input }));
  const applyStatus = vi.fn(
    async (
      _id: string,
      _expected: SuiteBookingStatus,
      status: SuiteBookingStatus,
      _audit?: (saved: SuiteBooking) => unknown,
    ) => ({
      ...(current as SuiteBooking),
      status,
    }),
  );
  const repo = { getById: vi.fn(async () => current), create, applyStatus } as unknown as ISuiteBookingRepository;
  return { repo, create, applyStatus };
}

describe("RequestSuiteBooking", () => {
  it("requests a stay with the guest's account details", async () => {
    const { repo, create } = repoWith(null);
    await new RequestSuiteBooking(repo).execute(
      { checkIn: "2026-10-20", checkOut: "2026-10-22", guests: 2, note: "  " },
      GUEST,
      NOW,
    );
    expect(create.mock.calls[0][0]).toEqual({
      userId: "g1",
      guestName: "Sara",
      guestPhone: "0912",
      guests: 2,
      checkIn: "2026-10-20",
      checkOut: "2026-10-22",
      note: undefined,
    });
  });

  it("refuses past check-in, zero or too many nights, too far ahead, and bad guest counts", async () => {
    const useCase = new RequestSuiteBooking(repoWith(null).repo);
    for (const input of [
      { checkIn: "2026-10-19", checkOut: "2026-10-21", guests: 2 },
      { checkIn: "2026-10-22", checkOut: "2026-10-22", guests: 2 },
      { checkIn: "2026-10-22", checkOut: "2026-11-10", guests: 2 },
      { checkIn: "2027-03-01", checkOut: "2027-03-02", guests: 2 },
      { checkIn: "2026-10-22", checkOut: "2026-10-23", guests: 5 },
      { checkIn: "not-a-day", checkOut: "2026-10-23", guests: 2 },
    ]) {
      await expect(useCase.execute(input, GUEST, NOW)).rejects.toThrow(ValidationError);
    }
  });
});

describe("ChangeSuiteBooking", () => {
  it("confirms a request and audits it", async () => {
    const { repo, applyStatus } = repoWith(booking("requested"));
    await new ChangeSuiteBooking(repo).execute("s1", "confirmed", { id: "st", name: "Ali" });

    expect(applyStatus.mock.calls[0].slice(0, 3)).toEqual(["s1", "requested", "confirmed"]);
    const entry = applyStatus.mock.calls[0][3]?.(booking("confirmed")) as { entityLabel: string; action: string };
    expect(entry).toMatchObject({ entityLabel: "S-4", action: "suiteBooking.changed" });
  });

  it("refuses a step the workflow doesn't allow", async () => {
    await expect(
      new ChangeSuiteBooking(repoWith(booking("requested")).repo).execute("s1", "checkedOut", {
        id: "st",
        name: "Ali",
      }),
    ).rejects.toThrow(ConflictError);
  });

  it("takes back a Check in, logging it and telling the guest nothing", async () => {
    const { repo, applyStatus } = repoWith(booking("checkedIn"));
    const notifier = { notify: vi.fn() };
    const saved = await new ChangeSuiteBooking(repo, notifier).execute(
      "s1",
      "confirmed",
      { id: "st", name: "Ali" },
      { undo: true },
    );

    expect(saved.status).toBe("confirmed");
    expect(applyStatus.mock.calls[0].slice(0, 3)).toEqual(["s1", "checkedIn", "confirmed"]);
    const entry = applyStatus.mock.calls[0][3]?.(booking("confirmed")) as { action: string; changes: unknown[] };
    expect(entry.action).toBe("suiteBooking.changed");
    expect(entry.changes).toEqual([{ field: "status", before: "checkedIn", after: "confirmed" }]);
    // Back at `confirmed`, but the guest isn't told their stay was confirmed again.
    expect(notifier.notify).not.toHaveBeenCalled();
  });

  it("refuses an undo of anything else, and never steps back without the flag", async () => {
    for (const [from, to] of [
      ["confirmed", "requested"],
      ["checkedOut", "checkedIn"],
      ["cancelled", "confirmed"],
      ["noShow", "confirmed"],
      ["confirmed", "confirmed"],
    ] as const) {
      const { repo, applyStatus } = repoWith(booking(from));
      await expect(
        new ChangeSuiteBooking(repo).execute("s1", to, { id: "st", name: "Ali" }, { undo: true }),
      ).rejects.toThrow(ConflictError);
      expect(applyStatus).not.toHaveBeenCalled();
    }
    await expect(
      new ChangeSuiteBooking(repoWith(booking("checkedIn")).repo).execute("s1", "confirmed", { id: "st", name: "Ali" }),
    ).rejects.toThrow(ConflictError);
  });

  it("still tells the guest when a request is confirmed", async () => {
    const notifier = { notify: vi.fn() };
    await new ChangeSuiteBooking(repoWith(booking("requested")).repo, notifier).execute("s1", "confirmed", {
      id: "st",
      name: "Ali",
    });
    expect(notifier.notify).toHaveBeenCalledWith(expect.objectContaining({ kind: "suiteConfirmed" }));
  });
});

describe("canUndoSuiteBookingStatus", () => {
  it("allows exactly checkedIn → confirmed", () => {
    const allowed = SUITE_BOOKING_STATUSES.flatMap((from) =>
      SUITE_BOOKING_STATUSES.filter((to) => canUndoSuiteBookingStatus(from, to)).map((to) => `${from}→${to}`),
    );
    expect(allowed).toEqual(["checkedIn→confirmed"]);
  });
});

describe("CancelOwnSuiteBooking", () => {
  it("cancels the guest's own stay before the check-in day", async () => {
    const { repo, applyStatus } = repoWith(booking("confirmed"));
    await new CancelOwnSuiteBooking(repo).execute("s1", "g1", NOW);
    expect(applyStatus.mock.calls[0].slice(0, 3)).toEqual(["s1", "confirmed", "cancelled"]);
  });

  it("hides other guests' stays and refuses on the check-in day", async () => {
    await expect(
      new CancelOwnSuiteBooking(repoWith(booking("confirmed")).repo).execute("s1", "other", NOW),
    ).rejects.toThrow(NotFoundError);
    await expect(
      new CancelOwnSuiteBooking(repoWith(booking("confirmed", { checkIn: "2026-10-20" })).repo).execute(
        "s1",
        "g1",
        NOW,
      ),
    ).rejects.toThrow(ConflictError);
  });
});

describe("suite rules", () => {
  it("counts nights and treats back-to-back stays as free", () => {
    expect(suiteNights("2026-10-20", "2026-10-23")).toBe(3);
    expect(
      staysOverlap(
        { checkIn: "2026-10-20", checkOut: "2026-10-22" },
        { checkIn: "2026-10-22", checkOut: "2026-10-24" },
      ),
    ).toBe(false);
    expect(
      staysOverlap(
        { checkIn: "2026-10-20", checkOut: "2026-10-23" },
        { checkIn: "2026-10-22", checkOut: "2026-10-24" },
      ),
    ).toBe(true);
  });

  it("lets the guest cancel only before the check-in day", () => {
    expect(isGuestCancellableSuiteBooking({ status: "requested", checkIn: "2026-10-21" }, "2026-10-20")).toBe(true);
    expect(isGuestCancellableSuiteBooking({ status: "checkedIn", checkIn: "2026-10-21" }, "2026-10-20")).toBe(false);
  });
});
