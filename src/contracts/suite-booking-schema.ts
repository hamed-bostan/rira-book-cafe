import { isCafeDay } from "@/src/domain/entities/CafeTime";
import { isPlausiblePhone } from "@/src/domain/entities/Phone";
import {
  MAX_SUITE_GUEST_NAME_LENGTH,
  MAX_SUITE_GUESTS,
  MAX_SUITE_NOTE_LENGTH,
  MIN_SUITE_GUESTS,
  SUITE_BOOKING_STATUSES,
} from "@/src/domain/entities/SuiteBooking";
import * as z from "@/src/lib/zod";

import { fieldsParsed } from "./fields-parsed";

/**
 * Suite-booking contracts shared by the route handlers and their clients. Days
 * travel as cafe days (`YYYY-MM-DD`, what a `date` input holds). Messages are
 * `formErrors` keys.
 */

const stayFields = z.object({
  checkIn: z.string().check(z.refine(isCafeDay, "dateInvalid")),
  checkOut: z.string().check(z.refine(isCafeDay, "dateInvalid")),
  guests: z
    .number()
    .check(
      z.int("suiteGuestsInvalid"),
      z.gte(MIN_SUITE_GUESTS, "suiteGuestsInvalid"),
      z.lte(MAX_SUITE_GUESTS, "suiteGuestsInvalid"),
    ),
  note: z.pipe(
    z.optional(z.string().check(z.trim(), z.maxLength(MAX_SUITE_NOTE_LENGTH, "noteTooLong"))),
    z.transform((value) => (value ? value : undefined)),
  ),
});

const checkOutAfterCheckIn = {
  check: (data: { checkIn: string; checkOut: string }): boolean => data.checkOut > data.checkIn,
  issue: { error: "checkOutBeforeCheckIn", path: ["checkOut"], when: fieldsParsed("note") },
};

/** A guest asking for the suite. */
export const requestSuiteBookingSchema = stayFields.check(
  z.refine(checkOutAfterCheckIn.check, checkOutAfterCheckIn.issue),
);

export type RequestSuiteBookingInput = z.input<typeof requestSuiteBookingSchema>;

/** Staff booking the suite for a guest who rang or asked at the counter; it's confirmed straight away. */
export const staffSuiteBookingSchema = z
  .extend(stayFields, {
    guestName: z
      .string()
      .check(z.trim(), z.minLength(1, "nameRequired"), z.maxLength(MAX_SUITE_GUEST_NAME_LENGTH, "nameTooLong")),
    guestPhone: z.string().check(z.trim(), z.refine(isPlausiblePhone, "phoneInvalid")),
  })
  .check(z.refine(checkOutAfterCheckIn.check, checkOutAfterCheckIn.issue));

export type StaffSuiteBookingInput = z.input<typeof staffSuiteBookingSchema>;

/**
 * Staff moving a stay along — or, with `undo`, taking back a Check in from its
 * toast (the use-case allows only `checkedIn → confirmed`).
 */
export const suiteBookingUpdateSchema = z.object({
  status: z.enum(SUITE_BOOKING_STATUSES, { error: "statusInvalid" }),
  undo: z.optional(z.literal(true)),
});

export type SuiteBookingUpdateInput = z.input<typeof suiteBookingUpdateSchema>;

/**
 * Staff editing a stay ("Edit stay"): its arrival and departure days and how many
 * it's for. Each is optional — one left out keeps its value — and the use-case
 * changes only what differs and what the stay's status allows (only the departure
 * once the guest is in).
 */
export const suiteStaySchema = z
  .object({
    checkIn: z.optional(stayFields.shape.checkIn),
    checkOut: z.optional(stayFields.shape.checkOut),
    guests: z.optional(stayFields.shape.guests),
  })
  .check(
    z.refine((data) => !data.checkIn || !data.checkOut || data.checkOut > data.checkIn, {
      error: "checkOutBeforeCheckIn",
      path: ["checkOut"],
    }),
  );

export type SuiteStayInput = z.input<typeof suiteStaySchema>;
