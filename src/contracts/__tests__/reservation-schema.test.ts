import { describe, expect, it } from "vitest";

import {
  MAX_PARTY_SIZE,
  MAX_RESERVATION_NOTE_LENGTH,
  MAX_TABLE_LABEL_LENGTH,
  MIN_PARTY_SIZE,
} from "@/src/domain/entities/Reservation";

import { requestReservationSchema, reservationUpdateSchema } from "../reservation-schema";

import { flattened } from "./zod-issues";

describe("requestReservationSchema", () => {
  it("trims the note and turns blank or absent into undefined", () => {
    expect(
      requestReservationSchema.parse({ startsAt: "2026-10-21T19:30", partySize: 4, note: " Window seat " }),
    ).toEqual({
      startsAt: "2026-10-21T19:30",
      partySize: 4,
      note: "Window seat",
    });
    expect(
      requestReservationSchema.parse({ startsAt: "2026-10-21T19:30", partySize: 2, note: "  " }).note,
    ).toBeUndefined();
  });

  it("bounds the party size to whole guests", () => {
    for (const partySize of [MIN_PARTY_SIZE, MAX_PARTY_SIZE]) {
      expect(requestReservationSchema.safeParse({ startsAt: "2026-10-21T19:30", partySize }).success).toBe(true);
    }
    for (const partySize of [MIN_PARTY_SIZE - 1, MAX_PARTY_SIZE + 1, 2.5]) {
      expect(
        flattened(requestReservationSchema.safeParse({ startsAt: "2026-10-21T19:30", partySize }).error)?.fieldErrors
          .partySize,
      ).toEqual(["partySizeInvalid"]);
    }
  });

  it("maps a bad time and an oversized note to their message keys", () => {
    const result = requestReservationSchema.safeParse({
      startsAt: "2026-10-21 19:30",
      partySize: 2,
      note: "n".repeat(MAX_RESERVATION_NOTE_LENGTH + 1),
    });
    expect(flattened(result.error)?.fieldErrors).toEqual({ startsAt: ["dateTimeInvalid"], note: ["noteTooLong"] });
  });
});

describe("reservationUpdateSchema", () => {
  it("accepts a status, a trimmed table, or both", () => {
    expect(reservationUpdateSchema.parse({ status: "confirmed" })).toEqual({ status: "confirmed" });
    expect(reservationUpdateSchema.parse({ tableLabel: " T4 " })).toEqual({ tableLabel: "T4" });
    expect(reservationUpdateSchema.parse({ status: "seated", tableLabel: "T4" })).toEqual({
      status: "seated",
      tableLabel: "T4",
    });
  });

  it("reports an empty change on the form, not a field", () => {
    const errors = flattened(reservationUpdateSchema.safeParse({}).error);
    expect(errors?.formErrors).toEqual(["nothingToChange"]);
    expect(errors?.fieldErrors).toEqual({});
  });

  it("takes an undo with just the status to go back to", () => {
    expect(reservationUpdateSchema.parse({ status: "confirmed", undo: true })).toEqual({
      status: "confirmed",
      undo: true,
    });
    for (const body of [
      { undo: true, tableLabel: "T4" },
      { status: "confirmed", tableLabel: "T4", undo: true },
    ]) {
      expect(flattened(reservationUpdateSchema.safeParse(body).error)?.fieldErrors.status).toEqual(["statusInvalid"]);
    }
    expect(reservationUpdateSchema.safeParse({ status: "confirmed", undo: false }).success).toBe(false);
  });

  it("refuses an unknown status and an oversized table label", () => {
    expect(flattened(reservationUpdateSchema.safeParse({ status: "late" }).error)?.fieldErrors.status).toEqual([
      "statusInvalid",
    ]);
    expect(
      flattened(reservationUpdateSchema.safeParse({ tableLabel: "t".repeat(MAX_TABLE_LABEL_LENGTH + 1) }).error)
        ?.fieldErrors.tableLabel,
    ).toEqual(["tableTooLong"]);
  });
});
