import { CAFE_TABLE_LABELS } from "@/src/domain/entities/CafeTable";
import { isWallTime } from "@/src/domain/entities/CafeTime";
import { isPlausiblePhone } from "@/src/domain/entities/Phone";
import {
  MAX_GUEST_NAME_LENGTH,
  MAX_PARTY_SIZE,
  MAX_RESERVATION_NOTE_LENGTH,
  MAX_TABLE_LABEL_LENGTH,
  MIN_PARTY_SIZE,
  RESERVATION_STATUSES,
} from "@/src/domain/entities/Reservation";
import * as z from "@/src/lib/zod";

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

/** Staff booking a table for a guest who rang or walked in; with a table it's confirmed on the spot. */
export const staffReservationSchema = z.extend(requestReservationSchema, {
  guestName: z
    .string()
    .check(z.trim(), z.minLength(1, "nameRequired"), z.maxLength(MAX_GUEST_NAME_LENGTH, "nameTooLong")),
  guestPhone: z.string().check(z.trim(), z.refine(isPlausiblePhone, "phoneInvalid")),
  tableLabel: z.optional(z.enum(CAFE_TABLE_LABELS, { error: "tableInvalid" })),
});

export type StaffReservationInput = z.input<typeof staffReservationSchema>;

/**
 * Staff acting on a reservation: a new status, a table, or both — or, with
 * `undo`, taking back a Seat or Complete from its toast: just the `status` to go
 * back to (the use-case allows only `seated → confirmed` and `completed → seated`).
 */
export const reservationUpdateSchema = z
  .object({
    status: z.optional(z.enum(RESERVATION_STATUSES, { error: "statusInvalid" })),
    tableLabel: z.optional(z.nullable(z.string().check(z.trim(), z.maxLength(MAX_TABLE_LABEL_LENGTH, "tableTooLong")))),
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
