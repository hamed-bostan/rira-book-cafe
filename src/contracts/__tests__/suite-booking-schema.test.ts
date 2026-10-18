import { describe, expect, it } from "vitest";

import { MAX_SUITE_GUESTS, MAX_SUITE_NOTE_LENGTH, MIN_SUITE_GUESTS } from "@/src/domain/entities/SuiteBooking";

import { requestSuiteBookingSchema, suiteBookingUpdateSchema, type RequestSuiteBookingInput } from "../suite-booking-schema";

const BOOKING: RequestSuiteBookingInput = { checkIn: "2026-11-01", checkOut: "2026-11-03", guests: 2, note: " Late arrival " };

describe("requestSuiteBookingSchema", () => {
  it("trims the note and turns blank or absent into undefined", () => {
    expect(requestSuiteBookingSchema.parse(BOOKING)).toEqual({ ...BOOKING, note: "Late arrival" });
    expect(requestSuiteBookingSchema.parse({ ...BOOKING, note: undefined }).note).toBeUndefined();
    expect(requestSuiteBookingSchema.parse({ ...BOOKING, note: " " }).note).toBeUndefined();
  });

  it("needs at least one night", () => {
    for (const checkOut of ["2026-11-01", "2026-10-31"]) {
      expect(requestSuiteBookingSchema.safeParse({ ...BOOKING, checkOut }).error?.flatten().fieldErrors.checkOut).toEqual(["checkOutBeforeCheckIn"]);
    }
  });

  it("bounds the guest count to whole guests", () => {
    for (const guests of [MIN_SUITE_GUESTS, MAX_SUITE_GUESTS]) {
      expect(requestSuiteBookingSchema.safeParse({ ...BOOKING, guests }).success).toBe(true);
    }
    for (const guests of [MIN_SUITE_GUESTS - 1, MAX_SUITE_GUESTS + 1, 1.5]) {
      expect(requestSuiteBookingSchema.safeParse({ ...BOOKING, guests }).error?.flatten().fieldErrors.guests).toEqual(["suiteGuestsInvalid"]);
    }
  });

  it("maps bad days and an oversized note to their message keys", () => {
    expect(
      requestSuiteBookingSchema.safeParse({ ...BOOKING, checkIn: "Nov 1", checkOut: "2026/11/03", note: "n".repeat(MAX_SUITE_NOTE_LENGTH + 1) }).error?.flatten()
        .fieldErrors,
    ).toEqual({ checkIn: ["dateInvalid"], checkOut: ["dateInvalid"], note: ["noteTooLong"] });
  });
});

describe("suiteBookingUpdateSchema", () => {
  it("accepts a known status and refuses others", () => {
    expect(suiteBookingUpdateSchema.parse({ status: "checkedIn" })).toEqual({ status: "checkedIn" });
    expect(suiteBookingUpdateSchema.safeParse({ status: "departed" }).error?.flatten().fieldErrors.status).toEqual(["statusInvalid"]);
  });
});
