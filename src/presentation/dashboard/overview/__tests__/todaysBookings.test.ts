import { describe, expect, it } from "vitest";

import {
  DAY_BOOKING_STATUSES,
  RESERVATION_STATUSES,
  type Reservation,
  type ReservationStatus,
} from "@/src/domain/entities/Reservation";

import { FINISHED_BOOKING_STATUS, splitTodaysBookings } from "../todaysBookings";

function booking(status: ReservationStatus, index = 0): Reservation {
  return {
    id: `${status}-${index}`,
    reference: index + 1,
    guestName: "Sara",
    guestPhone: "09120000000",
    partySize: 2,
    startsAt: "2026-11-03T15:00:00.000Z",
    durationMinutes: 90,
    status,
    createdAt: "2026-11-03T08:00:00.000Z",
    updatedAt: "2026-11-03T08:00:00.000Z",
  };
}

describe("splitTodaysBookings", () => {
  it("lists the bookings still ahead and counts the finished ones, in order", () => {
    const day = RESERVATION_STATUSES.map((status, index) => booking(status, index));
    const { ahead, finished } = splitTodaysBookings(day);

    expect(ahead.map((reservation) => reservation.status)).toEqual(["requested", "confirmed", "seated"]);
    expect(finished).toBe(1);
  });

  it("accounts for every booking the card counts, and nothing it doesn't", () => {
    for (const status of RESERVATION_STATUSES) {
      const { ahead, finished } = splitTodaysBookings([booking(status)]);
      const counted = (DAY_BOOKING_STATUSES as readonly ReservationStatus[]).includes(status);

      expect(ahead.length + finished, status).toBe(counted ? 1 : 0);
    }
  });

  it("names the one status the list leaves out, for the link under it", () => {
    expect(splitTodaysBookings([booking(FINISHED_BOOKING_STATUS)])).toEqual({ ahead: [], finished: 1 });
  });
});
