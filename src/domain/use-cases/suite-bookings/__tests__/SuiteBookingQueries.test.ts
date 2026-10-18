import { describe, expect, it, vi } from "vitest";

import { canTransitionSuiteBooking, nextSuiteBookingStatuses, type SuiteBooking } from "../../../entities/SuiteBooking";
import { GetSuiteAvailability, ListOwnSuiteBookings, ListSuiteBookings } from "../SuiteBookingQueries";

import type { ISuiteBookingRepository } from "../../../repositories/ISuiteBookingRepository";

const BOOKING: SuiteBooking = {
  id: "s1",
  reference: 4,
  userId: "g1",
  guestName: "Sara",
  guestPhone: "0912",
  guests: 2,
  checkIn: "2026-10-25",
  checkOut: "2026-10-27",
  status: "confirmed",
  createdAt: "",
  updatedAt: "",
};

type Fake = {
  repo: ISuiteBookingRepository;
  listFrom: ReturnType<typeof vi.fn<ISuiteBookingRepository["listFrom"]>>;
  listForUser: ReturnType<typeof vi.fn<ISuiteBookingRepository["listForUser"]>>;
  listBusyFrom: ReturnType<typeof vi.fn<ISuiteBookingRepository["listBusyFrom"]>>;
};

function suites(): Fake {
  const listFrom = vi.fn<ISuiteBookingRepository["listFrom"]>(async () => [BOOKING]);
  const listForUser = vi.fn<ISuiteBookingRepository["listForUser"]>(async () => [BOOKING]);
  const listBusyFrom = vi.fn<ISuiteBookingRepository["listBusyFrom"]>(async () => [{ checkIn: BOOKING.checkIn, checkOut: BOOKING.checkOut }]);
  return { repo: { listFrom, listForUser, listBusyFrom } as unknown as ISuiteBookingRepository, listFrom, listForUser, listBusyFrom };
}

describe("suite booking queries", () => {
  it("lists the front desk's stays from a day, optionally by status", async () => {
    const { repo, listFrom } = suites();
    expect(await new ListSuiteBookings(repo).execute("2026-10-20", "confirmed")).toEqual([BOOKING]);
    expect(listFrom).toHaveBeenCalledWith("2026-10-20", "confirmed");
  });

  it("lists the guest's own stays", async () => {
    const { repo, listForUser } = suites();
    await new ListOwnSuiteBookings(repo).execute("g1");
    expect(listForUser).toHaveBeenCalledWith("g1");
  });

  it("reads availability from the cafe's today, which can be a day ahead of UTC", async () => {
    const { repo, listBusyFrom } = suites();
    // 22:00 UTC on the 20th is 01:30 on the 21st in Tehran.
    const busy = await new GetSuiteAvailability(repo).execute(new Date("2026-10-20T22:00:00Z"));
    expect(listBusyFrom).toHaveBeenCalledWith("2026-10-21");
    // Public: only the nights, no names.
    expect(busy).toEqual([{ checkIn: "2026-10-25", checkOut: "2026-10-27" }]);
  });

  it("knows the stay workflow", () => {
    expect(canTransitionSuiteBooking("confirmed", "checkedIn")).toBe(true);
    expect(canTransitionSuiteBooking("checkedOut", "checkedIn")).toBe(false);
    expect(nextSuiteBookingStatuses("cancelled")).toEqual([]);
  });
});
