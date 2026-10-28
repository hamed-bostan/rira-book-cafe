import { z } from "zod";

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

/**
 * Reservation contracts shared by the route handlers and their clients. Times
 * travel as cafe wall time (`YYYY-MM-DDTHH:mm`, what a `datetime-local` input
 * holds); the route converts to a UTC instant. Messages are `formErrors` keys.
 */

/** A guest asking for a table. */
export const requestReservationSchema = z.object({
  startsAt: z.string().refine(isWallTime, "dateTimeInvalid"),
  partySize: z
    .number()
    .int("partySizeInvalid")
    .min(MIN_PARTY_SIZE, "partySizeInvalid")
    .max(MAX_PARTY_SIZE, "partySizeInvalid"),
  note: z
    .string()
    .trim()
    .max(MAX_RESERVATION_NOTE_LENGTH, "noteTooLong")
    .optional()
    .transform((value) => (value ? value : undefined)),
});

export type RequestReservationInput = z.input<typeof requestReservationSchema>;

/** Staff booking a table for a guest who rang or walked in; with a table it's confirmed on the spot. */
export const staffReservationSchema = requestReservationSchema.extend({
  guestName: z.string().trim().min(1, "nameRequired").max(MAX_GUEST_NAME_LENGTH, "nameTooLong"),
  guestPhone: z.string().trim().refine(isPlausiblePhone, "phoneInvalid"),
  tableLabel: z.enum(CAFE_TABLE_LABELS, { error: "tableInvalid" }).optional(),
});

export type StaffReservationInput = z.input<typeof staffReservationSchema>;

/**
 * Staff acting on a reservation: a new status, a table, or both — or, with
 * `undo`, taking back a Seat or Complete from its toast: just the `status` to go
 * back to (the use-case allows only `seated → confirmed` and `completed → seated`).
 */
export const reservationUpdateSchema = z
  .object({
    status: z.enum(RESERVATION_STATUSES, { error: "statusInvalid" }).optional(),
    tableLabel: z.string().trim().max(MAX_TABLE_LABEL_LENGTH, "tableTooLong").nullable().optional(),
    undo: z.literal(true).optional(),
  })
  .refine((data) => data.status !== undefined || data.tableLabel !== undefined, {
    error: "nothingToChange",
  })
  .refine((data) => !data.undo || (data.status !== undefined && data.tableLabel === undefined), {
    error: "statusInvalid",
    path: ["status"],
  });

export type ReservationUpdateInput = z.input<typeof reservationUpdateSchema>;
