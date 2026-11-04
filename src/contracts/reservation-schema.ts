import { isWallTime } from "@/src/domain/entities/CafeTime";
import {
  MAX_PARTY_SIZE,
  MAX_RESERVATION_NOTE_LENGTH,
  MIN_PARTY_SIZE,
  RESERVATION_LENGTHS,
  RESERVATION_STATUSES,
} from "@/src/domain/entities/Reservation";
import * as z from "@/src/lib/zod";

import { floorTableLabelField } from "./cafe-table-schema";
import { guestNameField, guestPhoneField } from "./guest-schema";

/**
 * Reservation contracts shared by the route handlers and their clients. Times
 * travel as cafe wall time (`YYYY-MM-DDTHH:mm`, what a `datetime-local` input
 * holds); the route converts to a UTC instant. Messages are `formErrors` keys.
 */

/** A guest asking for a table. */
export const requestReservationSchema = z.object({
  startsAt: z.string().check(z.refine(isWallTime, "dateTimeInvalid")),
  partySize: z
    .number()
    .check(
      z.int("partySizeInvalid"),
      z.gte(MIN_PARTY_SIZE, "partySizeInvalid"),
      z.lte(MAX_PARTY_SIZE, "partySizeInvalid"),
    ),
  note: z.pipe(
    z.optional(z.string().check(z.trim(), z.maxLength(MAX_RESERVATION_NOTE_LENGTH, "noteTooLong"))),
    z.transform((value) => (value ? value : undefined)),
  ),
});

export type RequestReservationInput = z.input<typeof requestReservationSchema>;

/**
 * Staff booking a table for a guest, found by phone (the name makes them a profile
 * when the phone has none); with a table it's confirmed on the spot.
 */
export const staffReservationSchema = z.extend(requestReservationSchema, {
  guestPhone: guestPhoneField,
  guestName: guestNameField,
  tableLabel: z.optional(floorTableLabelField),
});

export type StaffReservationInput = z.input<typeof staffReservationSchema>;

/**
 * Staff acting on a reservation: a new status, a table from the floor plan (as a
 * new booking takes), or both — `null` clears the table — or, with `undo`, taking
 * back a Seat or Complete from its toast: just the `status` to go back to (the
 * use-case allows only `seated → confirmed` and `completed → seated`).
 */
export const reservationUpdateSchema = z
  .object({
    status: z.optional(z.enum(RESERVATION_STATUSES, { error: "statusInvalid" })),
    tableLabel: z.optional(z.nullable(floorTableLabelField)),
    undo: z.optional(z.literal(true)),
  })
  .check(
    z.refine((data) => data.status !== undefined || data.tableLabel !== undefined, {
      error: "nothingToChange",
    }),
    z.refine((data) => !data.undo || (data.status !== undefined && data.tableLabel === undefined), {
      error: "statusInvalid",
      path: ["status"],
    }),
  );

export type ReservationUpdateInput = z.input<typeof reservationUpdateSchema>;

/**
 * Staff editing a booking ("Edit booking"): its day and time (cafe wall time, as a
 * new booking's), party, length, the note (blank clears it) and the table (`null`
 * clears it) — not the guest, who is the booking's profile. Each is optional — one
 * left out keeps its value — and the use-case changes only what differs and what
 * the booking's status allows.
 */
export const reservationDetailsSchema = z.object({
  startsAt: z.optional(z.string().check(z.refine(isWallTime, "dateTimeInvalid"))),
  partySize: z.optional(
    z
      .number()
      .check(
        z.int("partySizeInvalid"),
        z.gte(MIN_PARTY_SIZE, "partySizeInvalid"),
        z.lte(MAX_PARTY_SIZE, "partySizeInvalid"),
      ),
  ),
  durationMinutes: z.optional(
    z.number().check(z.refine((value) => (RESERVATION_LENGTHS as readonly number[]).includes(value), "lengthInvalid")),
  ),
  note: z.optional(z.string().check(z.trim(), z.maxLength(MAX_RESERVATION_NOTE_LENGTH, "noteTooLong"))),
  tableLabel: z.optional(z.nullable(floorTableLabelField)),
});

export type ReservationDetailsInput = z.input<typeof reservationDetailsSchema>;
